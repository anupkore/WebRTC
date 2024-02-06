import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Index from './Components/Index';
import Test from './Components/Test';
import Recordings from './Components/Recordings';

function App() {
  return (
    <>
      <Router>
          <Routes>
            <Route path="/" element={<Test/>} />
            <Route path="/:myId/:remoteId/:role/:appointmentId" element={<Index/>} />
            <Route path="/test" element={<Test/>} />
            <Route path="/recordings/:appointmentId" element={<Recordings/>} />
          </Routes>
      </Router>
    </>
  );
}

export default App;
