import { useState } from "react";
import { Navigate } from "react-router-dom";
import { GraduationCap, ArrowRight } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
export default function AuthPage() {
  const { user, login } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      login(
        await api.post(
          mode === "login" ? "/auth/login" : "/auth/bootstrap",
          form,
        ),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <section className="auth-intro">
        <div className="brand">
          <span className="brand-mark">
            <GraduationCap />
          </span>
          <span>
            KRA<small>Académique</small>
          </span>
        </div>
        <div>
          <p className="eyebrow">PLATEFORME ACADÉMIQUE</p>
          <h1>Une semaine plus claire commence ici.</h1>
          <p>
            Emplois du temps, communications et accompagnement pédagogique
            réunis dans un espace calme et précis.
          </p>
        </div>
        <footer>© {new Date().getFullYear()} KRA Académique</footer>
      </section>
      <section className="auth-panel">
        <form onSubmit={submit}>
          <p className="eyebrow">
            {mode === "login" ? "BON RETOUR" : "INITIALISATION"}
          </p>
          <h2>
            {mode === "login"
              ? "Connectez-vous à votre espace."
              : "Créez le secrétariat principal."}
          </h2>
          <p className="muted">
            {mode === "login"
              ? "Utilisez vos identifiants professionnels."
              : "Cette étape est disponible uniquement lors du premier démarrage."}
          </p>
          {mode === "bootstrap" && (
            <div className="two-fields">
              <label>
                Prénom
                <input
                  required
                  minLength="2"
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                />
              </label>
              <label>
                Nom
                <input
                  required
                  minLength="2"
                  value={form.lastName}
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
                />
              </label>
            </div>
          )}
          <label>
            Adresse e-mail
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Mot de passe
            <input
              required
              type="password"
              minLength={mode === "login" ? 8 : 12}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          {error && <div className="alert error">{error}</div>}
          <button className="primary wide" disabled={busy}>
            {busy ? (
              "Veuillez patienter…"
            ) : mode === "login" ? (
              <>
                Se connecter <ArrowRight size={18} />
              </>
            ) : (
              "Initialiser l’espace"
            )}
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "bootstrap" : "login");
              setError("");
            }}
          >
            {mode === "login"
              ? "Premier accès ? Initialiser la plateforme"
              : "Revenir à la connexion"}
          </button>
        </form>
      </section>
    </div>
  );
}
