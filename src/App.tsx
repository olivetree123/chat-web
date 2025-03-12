import { useState } from 'react'
import { Link } from 'react-router-dom'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen w-full p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-center mb-8">
          <a href="https://vite.dev" target="_blank" className="mx-2">
            <img src={viteLogo} className="logo" alt="Vite logo" />
          </a>
          <a href="https://react.dev" target="_blank" className="mx-2">
            <img src={reactLogo} className="logo react" alt="React logo" />
          </a>
        </div>
        <h1 className="text-center text-4xl font-bold mb-8">Vite + React</h1>
        <div className="card mb-8 max-w-md mx-auto">
          <button onClick={() => setCount((count) => count + 1)} className="mb-4">
            count is {count}
          </button>
          <p>
            Edit <code>src/App.tsx</code> and save to test HMR
          </p>
        </div>
        <p className="text-center mb-8">
          Click on the Vite and React logos to learn more
        </p>
        <div className="mt-8 text-center">
          <Link to="/chat" className="px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 inline-block">
            进入聊天界面
          </Link>
        </div>
      </div>
    </div>
  )
}

export default App
