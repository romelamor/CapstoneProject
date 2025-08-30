import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import UserRegister from './pages/UserRegister.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/dashboard';
import AdminInfo from "./pages/AdminInfo";
import AdminCrime from "./pages/AdminCrime";
import AdminSuspect from "./pages/AdminSuspect";
import VictimeSupectTable from "./pages/VictimeSuspectTables.jsx";
import AdminMaps from "./pages/AdminMaps.jsx";
import AdminAnalytics from "./pages/AdminAnalytics.jsx";

// user
import Userlogin from './pages/Userlogin.jsx';
import UserDashboard from './pages/UserDashboard.jsx';



// import PrivateRoute from './components/PrivateRoute';

import 'leaflet/dist/leaflet.css';


function App() {
  return (
    <Routes>
      <Route path="/UserDashboard" element={<UserDashboard />} />
      <Route path="/" element={<Userlogin />} />
      <Route path="/Userlogin" element={<Userlogin />} />
      <Route path="/UserRegister" element={<UserRegister />} />
      {/* admin */}
      <Route path="/Login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard/>} />
      <Route path="/AdminInfo" element={<AdminInfo />} />
      <Route path="/AdminCrime" element={<AdminCrime />} />
      <Route path="/AdminSuspect" element={<AdminSuspect />} />
      <Route path="/VictimeSupectTable" element={<VictimeSupectTable />} />
      <Route path="/AdminMaps" element={<AdminMaps />} />
      <Route path="/AdminAnalytics" element={<AdminAnalytics />} />
       
      
    </Routes>



  );
}

export default App;
