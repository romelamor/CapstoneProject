import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../assets/css/dashboard.css';

function UserDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <>
      {/* TOP NAV */}
      <header className="topnav">
        <button className="menu-icon" id="menu-toggle" onClick={toggleSidebar}>
          ☰
        </button>
        <h1 className="nav-title">Dashboard</h1>
      </header>

      {/* OVERLAY */}
      {sidebarOpen && <div id="overlay" className="overlay" onClick={toggleSidebar}></div>}

      <div className={`container ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {/* SIDEBAR */}
        <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`} id="sidebar">
          <div className="logo-section">
            <img src="/logo.png" className="logo" alt="PNP Maritime Logo" />
            <p>
              <strong>PNP MARITIME</strong>
              <br />
              Dashboard
            </p>
          </div>

          <nav>
            <ul className="nav-links">
              <li>
                <Link to="/incident-reports">
                  <span role="img" aria-label="incident">📄</span> Incident Reports
                </Link>
              </li>
              <li>
                <Link to="/maps">
                  <span role="img" aria-label="maps">📍</span> Maps
                </Link>
              </li>
              <li>
                <Link to="/profile-information">
                  <span role="img" aria-label="profile">⚙</span> Profile Information
                </Link>
              </li>
              <li>
                <Link to="/analytics">
                  <span role="img" aria-label="analytics">📊</span> Analytics
                </Link>
              </li>
              <li>
                <Link to="/notifications">
                  <span role="img" aria-label="notifications">🔔</span> Notifications
                </Link>
              </li>
              <li>
                <Link to="/logout" className="logout">
                  Logout
                </Link>
              </li>
            </ul>
          </nav>
        </aside>

        {/* MAIN CONTENT */}
        <main className="main-content">
          <h2>Welcome to the USER Dashboard!</h2>
        </main>
      </div>
    </>
  );
}

export default UserDashboard;
