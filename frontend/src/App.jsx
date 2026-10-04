import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";

// code-split every page except the landing page -> faster first load
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));
const MilkCheck = lazy(() => import("./pages/MilkCheck"));
const CheckHistory = lazy(() => import("./pages/CheckHistory"));
const AddAnimal = lazy(() => import("./pages/AddAnimal"));
const MilkRecords = lazy(() => import("./pages/MilkRecords"));
const ManageUsers = lazy(() => import("./pages/ManageUsers"));
const ManageCompanies = lazy(() => import("./pages/ManageCompanies"));
const Alerts = lazy(() => import("./pages/Alerts"));
const NotFound = lazy(() => import("./pages/NotFound"));

const Loading = () => <div className="page-loading" role="status" aria-label="Loading"><span className="spinner dark" /></div>;

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/model-report" element={<Navigate to="/" replace />} />

          <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute role="admin"><ManageUsers /></ProtectedRoute>} />
          <Route path="/admin/companies" element={<ProtectedRoute role="admin"><ManageCompanies /></ProtectedRoute>} />

          <Route path="/dashboard" element={<ProtectedRoute role="user"><UserDashboard /></ProtectedRoute>} />
          <Route path="/milk-check" element={<ProtectedRoute><MilkCheck /></ProtectedRoute>} />
          <Route path="/checks" element={<ProtectedRoute><CheckHistory /></ProtectedRoute>} />
          <Route path="/add-animal" element={<ProtectedRoute><AddAnimal /></ProtectedRoute>} />
          <Route path="/records" element={<ProtectedRoute><MilkRecords /></ProtectedRoute>} />
          <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />

          {/* consolidated routes: old pages now live inside others */}
          <Route path="/quality" element={<Navigate to="/milk-check" replace />} />
          <Route path="/disease" element={<Navigate to="/milk-check" replace />} />
          <Route path="/animal-sample" element={<Navigate to="/milk-check" replace />} />
          <Route path="/submit-milk" element={<Navigate to="/records" replace />} />
          <Route path="/ai-history" element={<Navigate to="/checks" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
