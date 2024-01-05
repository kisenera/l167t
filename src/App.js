import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import OpenAI from "openai";

const apiKey = process.env.REACT_APP_API_KEY;
const openai = new OpenAI({ apiKey: apiKey, dangerouslyAllowBrowser: true })


const subjects = [
  { name: 'Linear/Logistic Regression', id: 1 },
  { name: 'Gradient Descent', id: 2 },
  { name: 'Multilayer Perceptrons', id: 3 },
  { name: 'Word2Vec', id: 4 },
  { name: 'Autoregressive Models', id: 5 },
  { name: 'Attention', id: 6 },
  { name: 'Transformers', id: 7 },
  { name: 'Autoregressive Language Modeling', id: 8 },
];
const assistantMapping = {
  'Linear/Logistic Regression': 'asst_QOPUJxYnQdlmW1PECYreaZ99',
  'Gradient Descent': 'asst_Z018VWT8Ubg3L8JEbES14md8',
  'Multilayer Perceptrons': 'asst_NRT58rTT7gWxrayRunfmWrGQ',
  'Word2Vec': 'asst_v3x6vXPQsGcofF0TdI1QVtol',
  'Autoregressive Models': 'asst_mPPmc5pxHSPTNJvZ9hMHnlMu',
  'Attention': 'asst_b42bnuBLNEazTACNbHi0ZMzn',
  'Transformers': 'asst_sR6dZLes5uL4jQIaE4IhbgeF',
  'Autoregressive Language Modeling': 'asst_SDxyI1nc874hlhXjyMeI6ngD'
};

function formatNoteContent(note) {
  // Replace line breaks with <br> tags
  return note.replace(/\n/g, '<br>');
}

function Notes({ notes }) {
  useEffect(() => {
    if (window.MathJax) {
      window.MathJax.typesetPromise();
    }
  }, [notes]); // Re-run the effect when notes change

  return (
    <div className="Notes">
      {notes.map((note, index) => (
        <div key={index} className="Note" dangerouslySetInnerHTML={{ __html: formatNoteContent(note) }} />
      ))}
    </div>
  );
}
function App() {
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [notes, setNotes] = useState([]);
  const [showNotes, setShowNotes] = useState(false); // Add this line
  const addNote = (message) => {
    setNotes((prevNotes) => [...prevNotes, message]);
  };
  return (
    <div className="App">
      <h1 className="MainTitle">LIGN 167 Office Hours</h1>
      <div class="small-space"></div>
      {/* Render "Choose topic" only when no topic is selected */}
      {!selectedTopic && <div className="TitleHeader">Choose topic</div>}
      {!selectedTopic && (
        <button onClick={() => setShowNotes(!showNotes)} className="NotesButton">
          {showNotes ? 'Hide Notes' : 'Show Notes'}
        </button>
      )}

      {showNotes && <Notes notes={notes} />}

      {selectedTopic ? (
        <TopicHub
          topic={selectedTopic}
          backToMenu={() => setSelectedTopic(null)}
          addNote={addNote} // Pass addNote as a prop
        />
      ) : (
        <div className="Menu">
          {subjects.map((subject) => (
            <div key={subject.id} className="MenuItem" onClick={() => setSelectedTopic(subject)}>
              {subject.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TopicHub({ topic, backToMenu, addNote }) {
  const [chat, setChat] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [assistantId, setAssistantId] = useState(null);
  const [threadId, setThreadId] = useState(null);
  const [lastAiMessageId, setLastAiMessageId] = useState(null);
  const messageEndRef = useRef(null);
  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {

    const createAssistant = async () => {
      if (!topic) return;
      
      // Use the topic name to get the corresponding assistant ID from the mapping
      const assistantIdForTopic = assistantMapping[topic.name];
      if (!assistantIdForTopic) {
        console.error('Assistant ID for the topic not found');
        return;
      }
      
      const assistant = await openai.beta.assistants.retrieve(assistantIdForTopic);
      setAssistantId(assistant.id);

      const thread = await openai.beta.threads.create();
      setThreadId(thread.id);
    };

    createAssistant();
  }, []);
  useEffect(() => {
    // Use a microtask to delay typesetting until after the DOM has updated
    queueMicrotask(() => {
      if (window.MathJax) {
        window.MathJax.typesetPromise().then(() => {
          // Typeset is done
        }).catch((err) => console.error('MathJax typesetPromise failed:', err));
      }
    });
  }, [chat]);
  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
    const userMessage = { role: 'user', content: userInput };
    setChat([...chat, userMessage]);

    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: userInput
    });

    // Update the instructions with dynamic topic name
    const instructions = `You are speaking to a student at office hours, regarding ${topic.name}. Speak in a friendly, educated and intuitive manner. Give concise, relevant responses.`;

    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
      instructions: instructions
    });

    await checkRunStatus(run.id);
    setUserInput('');
  };

  const checkRunStatus = async (runId) => {
    let run = await openai.beta.threads.runs.retrieve(threadId, runId);
    while (run.status !== 'completed') {
      console.log(run.status);
      if (run.status === 'failed') {
        // Handle the failed status by breaking the loop and adding an error message to the chat
        const errorMessage = { role: 'ai', content: 'Error: The assistant has encountered an issue.' };
        setChat(prevChat => [...prevChat, errorMessage]);
        return; // Exit the function early
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      run = await openai.beta.threads.runs.retrieve(threadId, runId);
    }
    getAssistantResponse();
  };


  const getAssistantResponse = async () => {
    const response = await openai.beta.threads.messages.list(threadId);

    // Assuming response.data[0] is the latest message from the assistant.
    const latestMessage = response.data[0];

    if (latestMessage.role === 'assistant') {
      const textContent = latestMessage.content[0].text.value;

      // Create a new message object with the role and the content.
      const newMessage = { role: 'ai', content: textContent };

      // Use a functional update to ensure the chat state is updated correctly.
      // Add the new message to the chat state.
      setChat(prevChat => [...prevChat, newMessage]);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat]);

  return (
    <div className="Hub">
      <h1>{topic.name}</h1>
      <div className="ChatWindow">
        {chat.map((message, index) => (
          <div key={index} className={`ChatMessage ${message.role}`}>
            {message.content}
            {message.role === 'ai' && (
              <button onClick={() => addNote(message.content)} className="NoteButton">+</button>
            )}
          </div>
        ))}
        <div ref={messageEndRef} />
      </div>
      <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} className="InputBox" />
      <button onClick={handleSendMessage} className="SendButton">Send</button>
      <button onClick={backToMenu} className="BackButton">Back to Menu</button>
    </div>
  );
}

export default App;