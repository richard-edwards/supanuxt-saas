import { openai } from './openai.client';
import { AccountLimitError } from './errors';

import { db as drizzleDB } from '~~/drizzle/drizzle.client';
import { note, account } from '~~/drizzle/schema'
import { eq } from 'drizzle-orm'

export default class NotesService {
  async getAllNotes() {
    return await drizzleDB.select().from(note)
  }

  async getNoteById(id: number) {
    return await drizzleDB.select().from(note).where(eq(note.id, id))
  }

  async getNotesForAccountId(account_id: number) {
    return await drizzleDB.select().from(note).where(eq(note.accountId, account_id))
  }

  async createNote(account_id: number, note_text: string) {

    const this_account = await drizzleDB.query.account.findFirst({
      where: eq(account.id, account_id),
      with: {
        notes: true,
      },
    })

    if (!this_account) {
      throw new Error('Account not found');
    }

    if (this_account.notes.length >= this_account.maxNotes) {
      throw new AccountLimitError(
        'Note Limit reached, no new notes can be added'
      );
    }

    return await drizzleDB.insert(note)
      .values({ account_id: account_id, note_text: note_text })
      .returning()
  }

  async updateNote(id: number, note_text: string) {
    return await drizzleDB.update(note)
      .set({ note_text: note_text })
      .where(eq(note.id, id))
  }

  async deleteNote(id: number) {
    return await drizzleDB.delete(note).where(eq(note.id, id))
      .returning()
  }

  async generateAINoteFromPrompt(userPrompt: string, account_id: number) {
    // const accountService = new AccountService();
    // const account = await accountService.checkAIGenCount(account_id);

    const prompt = `
    Write an interesting short note about ${userPrompt}.
    Restrict the note to a single paragraph.
    `;
    const completion = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt,
      temperature: 0.6,
      stop: '\n\n',
      max_tokens: 1000,
      n: 1
    });

    // await accountService.incrementAIGenCount(account);

    return completion.data.choices[0].text;
  }
}
