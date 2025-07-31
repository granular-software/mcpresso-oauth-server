import { z } from "zod";
import { createResource } from "mcpresso";

// Example: A simple note resource (public access)
const NoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  createdAt: z.date(),
});

// In-memory storage (replace with your database)
const notes: z.infer<typeof NoteSchema>[] = [
  {
    id: "1",
    title: "Welcome Note",
    content: "This is a public note that anyone can access.",
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "2", 
    title: "Getting Started",
    content: "This server has no authentication - all data is public.",
    createdAt: new Date("2024-01-02"),
  },
];

// Create the notes resource
export const exampleResource = createResource({
  name: "note",
  schema: NoteSchema,
  uri_template: "notes/{id}",
  methods: {
    get: {
      description: "Get a note by ID (public access)",
      handler: async ({ id }) => {
        console.log(`Getting note ${id} (no auth required)`);
        return notes.find((note) => note.id === id);
      },
    },
    list: {
      description: "List all notes (public access)",
      handler: async () => {
        console.log("Listing all notes (no auth required)");
        return notes;
      },
    },
    create: {
      description: "Create a new note (public access)",
      handler: async (data) => {
        console.log("Creating note (no auth required):", data);
        
        const newNote = {
          id: (notes.length + 1).toString(),
          title: data.title || "Untitled",
          content: data.content || "",
          createdAt: new Date(),
        };
        
        notes.push(newNote);
        return newNote;
      },
    },
    delete: {
      description: "Delete a note (public access)",
      handler: async ({ id }) => {
        console.log(`Deleting note ${id} (no auth required)`);
        
        const index = notes.findIndex((note) => note.id === id);
        if (index === -1) {
          return { success: false };
        }
        
        notes.splice(index, 1);
        return { success: true };
      },
    },
    search: {
      description: "Search notes by content (public access)",
      inputSchema: z.object({
        query: z.string().describe("Search query"),
      }),
      handler: async ({ query }) => {
        console.log(`Searching notes for "${query}" (no auth required)`);
        return notes.filter((note) => 
          note.content.toLowerCase().includes(query.toLowerCase()) ||
          note.title.toLowerCase().includes(query.toLowerCase())
        );
      },
    },
  },
}); 