import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { CallProvider } from "./context/CallContext";

ReactDOM.createRoot(document.getElementById('root')).render(
  <CallProvider>
  
  <BrowserRouter>
 
    <App />

</BrowserRouter>

</CallProvider>
);
