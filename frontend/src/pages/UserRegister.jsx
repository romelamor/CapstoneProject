import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const UserRegister = () => {
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    badge_number: '',
    password: '',
    confirm_password: '',
    id_image: null,
  });

  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'id_image') {
      setFormData({ ...formData, id_image: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ Validate badge number (must be 6 digits)
    if (!/^\d{6}$/.test(formData.badge_number)) {
      setMessage('Badge number must be 6 digits.');
      return;
    }

    // ✅ Check if passwords match
    if (formData.password !== formData.confirm_password) {
      setMessage('Passwords do not match.');
      return;
    }

    // ✅ Prepare FormData for file upload
    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (key !== 'confirm_password') {
        data.append(key, value);
      }
    });

    try {
      const response = await axios.post('http://localhost:8000/api/register/', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setMessage(response.data.message || 'Registration successful.');

      // ✅ Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/Userlogin');
      }, 1000);
    } catch (error) {
      if (error.response?.data) {
        const errorMessages = Object.values(error.response.data).flat().join(', ');
        setMessage('Error: ' + errorMessages);
      } else {
        setMessage('Registration failed.');
      }
    }
  };

  return (
    <div className="registration-container">
      <h2>User Registration</h2>
      {message && <p style={{ color: 'red' }}>{message}</p>}
      <form onSubmit={handleSubmit} encType="multipart/form-data">
        <input
          type="text"
          name="username"
          placeholder="Username"
          onChange={handleChange}
          required
        />
        <input
          type="text"
          name="first_name"
          placeholder="First Name"
          onChange={handleChange}
          required
        />
        <input
          type="text"
          name="last_name"
          placeholder="Last Name"
          onChange={handleChange}
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          onChange={handleChange}
          required
        />
        <input
          type="text"
          name="badge_number"
          placeholder="6-digit Badge Number"
          maxLength={6}
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="confirm_password"
          placeholder="Confirm Password"
          onChange={handleChange}
          required
        />
        <input
          type="file"
          name="id_image"
          accept="image/*"
          onChange={handleChange}
          required
        />
        <button type="submit">Register</button>
      </form>
    </div>
  );
};

export default UserRegister;
