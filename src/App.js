import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import OpenAI from "openai";

const apiKey = process.env.REACT_APP_API_KEY;
const openai = new OpenAI({ apiKey: apiKey, dangerouslyAllowBrowser: true })


const subjects = [
  { name: 'Topic 1', id: 1 },
  { name: 'Topic 2', id: 2 },
  // ... add other topics up to Topic 12
];

function App() {
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);


  return (
    <div className="App">
      <div className="TitleHeader">AI Tutor</div>
      {selectedTopic ? (
        <TopicHub topic={selectedTopic} backToMenu={() => setSelectedTopic(null)} />
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

function TopicHub({ topic, backToMenu }) {
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
      const assistant = await openai.beta.assistants.retrieve('asst_R9nY3R5aZoMmwzGAPhOcA520')
      setAssistantId(assistant.id);

      const thread = await openai.beta.threads.create();
      setThreadId(thread.id);
    };

    createAssistant();
  }, []);

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
    const userMessage = { role: 'user', content: userInput };
    setChat([...chat, userMessage]);

    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: userInput
    });

    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
      instructions: "Please address the user as Jane Doe. The user has a premium account."
    });

    await checkRunStatus(run.id);
    setUserInput('');
  };

  const checkRunStatus = async (runId) => {
    let run = await openai.beta.threads.runs.retrieve(threadId, runId);
    while (run.status !== 'completed') {
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