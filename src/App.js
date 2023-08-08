import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Index from './Components/Index';
import Test from './Components/Test';

function App() {
  return (
    <>
      <Router>
          <Routes>
            <Route path="/" element={<Index/>} />
            <Route path="/test" element={<Test/>} />
          </Routes>
      </Router>
    </>
  );
}

export default App;
