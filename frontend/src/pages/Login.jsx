import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../assets/css/login.css';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(''); // ✅ para ma-set mo yung error message
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); // clear previous error
    try {
      const response = await axios.post("http://localhost:8000/api/admin/login/", { username, password });

      const { access, is_staff } = response.data;

      localStorage.setItem("token", access);
      localStorage.setItem("is_staff", is_staff);

      if (is_staff) {
        navigate("/dashboard"); // ✅ admin dashboard
      } else {
        setError("This login is for admin only.");
      }
    } catch (error) {
      setError("Invalid credentials. Please try again.");
    }
  };

  return (
    <div className="login">
      <form onSubmit={handleLogin}>
        <h2>Admin Login</h2>

        {error && <p className="error">{error}</p>} {/* show error message */}

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <a href="/Userlogin">Go to Userpage</a>
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

export default Login;
