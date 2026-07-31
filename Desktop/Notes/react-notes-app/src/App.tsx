import "./App.css";

function App() {
  const [note, setNote] = useState([]);

  return (
    <>
      <h1>React Notes App</h1>
      <input type="text"
      placeholder="Enter a note..."
             value={note}
             onChange={(event) => setNote(event.target.value)}
      />
      <button onClick={() => }>Save</button>
    </>
  );
}

export default App;
