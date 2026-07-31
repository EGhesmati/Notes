import { useState } from "react";
import "./App.css";

function App() {
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<string[]>([]);

  function addNote() {
    if (note.trim() === "") {
      return;
    }

    setNotes([...notes, note]);
    setNote("");
  }

  function deleteNote(indexToDelete: number) {
    const updatedNotes = notes.filter((_, index) => index !== indexToDelete);
    setNotes(updatedNotes);
  }

  return (
    <div className="container">
      <h1>React Notes App</h1>

      <input
        type="text"
        placeholder="Enter a note..."
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />

      <button onClick={addNote}>Add Note</button>

      <hr />

      {notes.map((item, index) => (
        <div className="note" key={index}>
          <p>{item}</p>

          <button onClick={() => deleteNote(index)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

export default App;
