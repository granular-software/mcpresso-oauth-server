import { Resource } from 'mcpresso';
import { z } from 'zod';

// In-memory storage for demo
const notes = new Map<string, { id: string; title: string; content: string; createdAt: string }>();

// Note schema
const NoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  createdAt: z.string()
});

export const notesResource: Resource = {
  name: 'notes',
  description: 'Simple notes management',
  schema: NoteSchema,
  
  // List all notes
  list: async () => {
    return Array.from(notes.values());
  },
  
  // Get a specific note
  get: async (id: string) => {
    const note = notes.get(id);
    if (!note) {
      throw new Error(`Note with id ${id} not found`);
    }
    return note;
  },
  
  // Create a new note
  create: async (data: { title: string; content: string }) => {
    const id = Date.now().toString();
    const note = {
      id,
      title: data.title,
      content: data.content,
      createdAt: new Date().toISOString()
    };
    notes.set(id, note);
    return note;
  },
  
  // Update a note
  update: async (id: string, data: Partial<{ title: string; content: string }>) => {
    const note = notes.get(id);
    if (!note) {
      throw new Error(`Note with id ${id} not found`);
    }
    
    const updatedNote = { ...note, ...data };
    notes.set(id, updatedNote);
    return updatedNote;
  },
  
  // Delete a note
  delete: async (id: string) => {
    const note = notes.get(id);
    if (!note) {
      throw new Error(`Note with id ${id} not found`);
    }
    notes.delete(id);
    return { success: true };
  },
  
  // Search notes
  search: async (query: string) => {
    const results = Array.from(notes.values()).filter(note =>
      note.title.toLowerCase().includes(query.toLowerCase()) ||
      note.content.toLowerCase().includes(query.toLowerCase())
    );
    return results;
  }
};
