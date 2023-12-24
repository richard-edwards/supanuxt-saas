import { H3Event, getQuery } from 'h3';
import { defineProtectedEventHandler } from '../defineProtectedEventHandler';
import NotesService from '~/lib/services/notes.service';

// Example API Route with query params ... /api/note?note_id=41
export default defineProtectedEventHandler(async (event: H3Event) => {
  try {
    const queryParams = getQuery(event);
    let note_id: string = '';
    if (queryParams.note_id) {
      if (Array.isArray(queryParams.note_id)) {
        note_id = queryParams.note_id[0];
      } else {
        note_id = queryParams.note_id.toString();
      }
    }

    const notesService = new NotesService();
    const note = await notesService.getNoteById(+note_id);

    return {
      note
    };
  } catch (error) {
    console.error(error);
    return {
      error: 'An error occurred while fetching the note.'
    };
  }
});
