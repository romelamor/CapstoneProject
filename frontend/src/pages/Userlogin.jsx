import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';


function Userlogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  // UserLogin.jsx (gawa ka nito kung wala pa)
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post("http://localhost:8000/api/user/login/", {
        username,
        password,
      });
      const isAdmin = response.data.is_admin;

      if (isAdmin) {
        alert("Admin accounts are not allowed to login here.");
        return;
      }

      localStorage.setItem("access_token", response.data.access);
      localStorage.setItem("refresh_token", response.data.refresh);
      localStorage.setItem("is_admin", isAdmin);

      navigate("/UserDashboard");
    } catch (error) {
      console.error(error);
      alert("Invalid credentials");
    }
  };

  return (
    <div className="login">
      <form onSubmit={handleSubmit}>
        <h2>Welcome Back</h2>
        <p className="subtitle">Login to your account</p>

        <input
          type="text"
          placeholder="Enter your username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="form-links">
          <Link to="/forgot-password">Forgot Password?</Link>
        </div>

        <button type="submit">Sign In</button>

        <div className="form-links">
          <p>Don't have an account? <Link to="/UserRegister">Create one</Link></p>
        </div>

        <div className="form-links">
          <Link to="/Login">Login as Admin</Link>
        </div>
      </form>
    </div>
  );
}

export default Userlogin;
