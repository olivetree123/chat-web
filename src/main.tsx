import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import './index.css'
import App from './App.tsx'
import Chat from './pages/Chat.tsx'

// 添加全局样式以确保页面充满整个视口并防止滚动
const rootStyle = document.createElement('style');
rootStyle.textContent = `
  body{
    background-color: rgb(241,240,251);
  }
  #root {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
`;
document.head.appendChild(rootStyle);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/chat" element={<Chat />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
