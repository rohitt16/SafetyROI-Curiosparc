import { useState, useEffect, useMemo } from "react";
import axios from "axios";

import heroIllustration from "./assets/hero.png";
import HotspotMap from "./components/HotspotMap";
import "./App.css";

const API_BASE =
  import.meta.env.VITE_API_URL || "https://roadshield-ai.onrender.com";

const DEMO_SCENARIOS = [
  {
    id: "rain-traffic",
    label: "Heavy Rain + Traffic",
    city: "Delhi",
    hour: 18,
    day_of_week: "Monday",
    is_weekend: 0,
    road_type: "urban",
    lanes: 4,
    traffic_signal: 1,
    weather: "rain",
    visibility: 3,
    temperature: 27,
    traffic_density: "high",
    vehicles_involved: 3,
    is_peak_hour: 1,
  },
  {
    id: "clear-safe",
    label: "Clear Weather",
    city: "Bangalore",
    hour: 10,
    day_of_week: "Wednesday",
    is_weekend: 0,
    road_type: "highway",
    lanes: 6,
    traffic_signal: 1,
    weather: "clear",
    visibility: 12,
    temperature: 28,
    traffic_density: "low",
    vehicles_involved: 1,
    is_peak_hour: 0,
  },
  {
    id: "night-rain",
    label: "Night + Rain",
    city: "Mumbai",
    hour: 21,
    day_of_week: "Friday",
    is_weekend: 1,
    road_type: "urban",
    lanes: 4,
    traffic_signal: 1,
    weather: "rain",
    visibility: 5,
    temperature: 24,
    traffic_density: "high",
    vehicles_involved: 4,
    is_peak_hour: 1,
  },
];

const DEFAULT_FORM = {
  city: "Delhi",
  hour: 18,
  day_of_week: "Monday",
  is_weekend: 0,
  road_type: "urban",
  lanes: 4,
  traffic_signal: 1,
  weather: "rain",
  visibility: 3,
  temperature: 28,
  traffic_density: "high",
  vehicles_involved: 2,
  is_peak_hour: 1,
};

const toRiskTone = (score) => {
  if (score >= 81) return "critical";
  if (score >= 61) return "high";
  if (score >= 31) return "medium";
  return "low";
};

const toRiskLevel = (score) => {
  if (score >= 81) return "Critical";
  if (score >= 61) return "High";
  if (score >= 31) return "Medium";
  return "Low";
};

const getFactorDescriptors = (label) => {
  const lookup = {
    Visibility: "Reduced visibility increases driver reaction time.",
    "Traffic Density": "High traffic density increases collision probability.",
    Weather: "Wet or unstable weather increases braking distance.",
    "Peak Hour": "Congestion and driver stress are higher during peak periods.",
    Temperature: "Extreme temperatures affect tire grip and driver comfort.",
    "Road Type": "Road geometry and layout affect maneuvering safety.",
    "Day/Night": "Low-light conditions reduce time to react to hazards.",
  };

  return lookup[label] || "This factor contributes materially to the current risk profile.";
};

function App() {
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [weatherInfo, setWeatherInfo] = useState(null);
  const [error, setError] = useState("");
  const [authenticated, setAuthenticated] = useState(() => {
    return sessionStorage.getItem("roadshield-session") === "active";
  });
  const [profile, setProfile] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("roadshield-profile") || "null");
    } catch {
      return null;
    }
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [assistantReply, setAssistantReply] = useState(
    "I can help interpret the latest road safety signals and recommended actions."
  );
  const [loginData, setLoginData] = useState({
    name: "",
    organization: "",
    role: "",
    location: "",
    email: "",
    password: "",
  });
  const [loginError, setLoginError] = useState("");
  const [authView, setAuthView] = useState("login");
  const [authNotice, setAuthNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emergencyAlert, setEmergencyAlert] = useState(null);
  // SafetyROI uses the light dashboard as the default visual theme.
  // The existing theme toggle remains available for users who prefer dark mode.
  const [darkMode, setDarkMode] = useState(() => {
    const storedTheme = localStorage.getItem("theme");
    return storedTheme === "dark";
  });
  const [showHome, setShowHome] = useState(() => {
    return sessionStorage.getItem("roadshield-session") !== "active";
  });
  const [showMapPage, setShowMapPage] = useState(false);
  const themeClass = darkMode ? "dark" : "light";
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [history, setHistory] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("roadshield-history") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const theme = darkMode ? "dark" : "light";
    localStorage.setItem("theme", theme);
    document.body.classList.remove("dark", "light");
    document.body.classList.add(theme);
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem("roadshield-history", JSON.stringify(history));
  }, [history]);

  const handleOpenMapPage = () => setShowMapPage(true);
  const handleBackToDashboard = () => setShowMapPage(false);

  const currentRiskScore = useMemo(() => {
    if (!result) return 72;
    return Math.max(0, Math.min(100, Number(result.risk_score || 0) * 100));
  }, [result]);

  const currentRiskLevel = useMemo(
    () => toRiskLevel(currentRiskScore),
    [currentRiskScore]
  );

  const riskFactorEntries = useMemo(() => {
    if (!result?.risk_factors) {
      return [
        { label: "Visibility", value: 30.4, description: getFactorDescriptors("Visibility") },
        { label: "Traffic Density", value: 28.2, description: getFactorDescriptors("Traffic Density") },
        { label: "Weather", value: 23.1, description: getFactorDescriptors("Weather") },
        { label: "Peak Hour", value: 8.0, description: getFactorDescriptors("Peak Hour") },
      ];
    }

    return Object.entries(result.risk_factors)
      .map(([label, value]) => {
        const numericValue = Number.parseFloat(String(value).replace("%", ""));
        return {
          label,
          value: Number.isFinite(numericValue) ? numericValue : 0,
          description: getFactorDescriptors(label),
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [result]);

  const routeComparison = [
    {
      route: "Route A",
      risk: 72,
      traffic: "High",
      eta: "3h 45m",
      note: "Heavy congestion through the busiest corridor.",
    },
    {
      route: "Route B",
      risk: 38,
      traffic: "Medium",
      eta: "4h 05m",
      note: "Lower predicted risk despite a slightly longer trip.",
    },
    {
      route: "Route C",
      risk: 51,
      traffic: "Medium",
      eta: "3h 55m",
      note: "Moderate exposure with manageable traffic flow.",
    },
  ];

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleNumericChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: Number(value),
    }));
  };

  const addHistoryEntry = (prediction) => {
    const score = Math.round(Number(prediction.risk_score || 0) * 100);
    const item = {
      id: `${Date.now()}`,
      timestamp: new Date().toISOString(),
      city: formData.city,
      score,
      level: toRiskLevel(score),
      weather: formData.weather,
    };

    setHistory((prev) => [item, ...prev].slice(0, 6));
  };

  const fetchWeather = async () => {
    try {
      setError("");
      const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;

      if (!apiKey) {
        const fallbackWeather = { weather: "rain", temperature: 27, visibility: 4 };
        setWeatherInfo(fallbackWeather);
        setFormData((prev) => ({
          ...prev,
          weather: fallbackWeather.weather,
          temperature: fallbackWeather.temperature,
          visibility: fallbackWeather.visibility,
        }));
        return;
      }

      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?q=${formData.city},IN&appid=${apiKey}&units=metric`
      );

      const data = response.data;
      let weatherType = "clear";

      if (data.weather[0].main.toLowerCase().includes("rain")) {
        weatherType = "rain";
      } else if (data.weather[0].main.toLowerCase().includes("fog")) {
        weatherType = "fog";
      }

      const nextWeather = {
        weather: weatherType,
        temperature: Math.round(data.main.temp),
        visibility: Math.round((data.visibility || 10000) / 1000),
      };

      setWeatherInfo(nextWeather);
      setFormData((prev) => ({
        ...prev,
        weather: weatherType,
        temperature: nextWeather.temperature,
        visibility: nextWeather.visibility,
      }));
    } catch {
      setError("Unable to retrieve live weather data. The form remains editable.");
    }
  };

  const predictRisk = async () => {
    try {
      setLoading(true);
      setError("");

      const payload = {
        city: formData.city,
        hour: Number(formData.hour),
        day_of_week: formData.day_of_week,
        is_weekend: Number(formData.is_weekend),
        road_type: formData.road_type,
        lanes: Number(formData.lanes),
        traffic_signal: Number(formData.traffic_signal),
        weather: formData.weather,
        visibility: Number(formData.visibility),
        temperature: Number(formData.temperature),
        traffic_density: formData.traffic_density,
        vehicles_involved: Number(formData.vehicles_involved),
        is_peak_hour: Number(formData.is_peak_hour),
      };

      const response = await axios.post(`${API_BASE}/predict`, payload);
      setResult(response.data);
      addHistoryEntry(response.data);
    } catch {
      setError("Unable to retrieve risk prediction. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const applyScenario = (scenario) => {
    setFormData(scenario);
    setResult(null);
    setError("");
  };

  const triggerEmergencyAlert = () => {
    const nextAlert = {
      title: "Emergency response alert triggered",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      level: currentRiskLevel,
      location: formData.city,
      familyNotice: `Registered family contact for ${profile?.name || "Road Safety Analyst"} received an SMS and push notification.`,
      ambulanceNotice: "Nearest ambulance driver was notified with live location and ETA details.",
      phoneCall: "Emergency call coordination was initiated to the response line and nearest hospital contact.",
    };

    setEmergencyAlert(nextAlert);
  };

  const handleAssistantQuery = (query) => {
    const safeSummary = currentRiskLevel === "Critical" ? "This corridor requires immediate intervention." : currentRiskLevel === "High" ? "This corridor needs close monitoring and quick action." : currentRiskLevel === "Medium" ? "This corridor is manageable but should be watched closely." : "This corridor is currently in a stable range.";

    const responses = {
      "Is this road safe?": `Based on the current forecast, this road is ${currentRiskLevel.toLowerCase()} risk. ${safeSummary}`,
      "Why is the risk high?": `The risk level is elevated because of the active conditions in ${formData.city}, including ${formData.weather} weather, ${formData.traffic_density} traffic density, and ${formData.visibility} km visibility.`,
      "What should I do?": `Prioritize a rapid response by dispatching support, checking nearby intersections, and reviewing the recommended interventions for this corridor.`,
      "How can I reduce my risk?": `Reduce exposure by improving visibility, adjusting traffic control, increasing patrolling in the hotspot zone, and accelerating the highest-priority intervention for the area.`,
    };

    setAssistantReply(responses[query] || "I can help with route safety, interventions, and risk interpretation.");
  };

  const persistSession = (nextProfile) => {
    sessionStorage.setItem("roadshield-session", "active");
    sessionStorage.setItem("roadshield-profile", JSON.stringify(nextProfile));
    setProfile(nextProfile);
    setAuthenticated(true);
    setLoginError("");
    setAuthNotice("");
  };

  const handleLogin = (event) => {
    event.preventDefault();

    if (!loginData.email || !loginData.password) {
      setLoginError("Please enter both your email and password.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginData.email)) {
      setLoginError("Please enter a valid email address.");
      return;
    }

    setLoginError("");
    setIsSubmitting(true);

    const nextProfile = {
      name: loginData.name || "Road Safety Analyst",
      organization: loginData.organization || "Road Safety Operations",
      role: loginData.role || "Safety Intelligence Analyst",
      location: loginData.location || "India",
      email: loginData.email,
    };

    persistSession(nextProfile);
    window.setTimeout(() => setIsSubmitting(false), 250);
  };

  const handleOpenSignup = () => {
    setAuthView("signup");
    setLoginError("");
    setAuthNotice("");
  };

  const handleOpenForgotPassword = () => {
    setAuthView("forgot");
    setLoginError("");
    setAuthNotice("");
  };

  const handleBackToLogin = () => {
    setAuthView("login");
    setLoginError("");
  };

  const handleSignup = (event) => {
    event.preventDefault();

    if (!loginData.email || !loginData.password) {
      setLoginError("Please enter your email and password to create an account.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginData.email)) {
      setLoginError("Please enter a valid email address.");
      return;
    }

    setLoginError("");
    setIsSubmitting(true);

    const nextProfile = {
      name: loginData.name || "New Road Safety Analyst",
      organization: loginData.organization || "Road Safety Operations",
      role: loginData.role || "Safety Intelligence Analyst",
      location: loginData.location || "India",
      email: loginData.email,
    };

    persistSession(nextProfile);
    window.setTimeout(() => setIsSubmitting(false), 250);
  };

  const handleForgotPassword = (event) => {
    event.preventDefault();

    if (!loginData.email) {
      setLoginError("Please enter your email address to receive reset instructions.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginData.email)) {
      setLoginError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    window.setTimeout(() => {
      setAuthNotice(`Password reset instructions were sent to ${loginData.email}.`);
      setAuthView("login");
      setLoginError("");
      setIsSubmitting(false);
    }, 250);
  };

  if (!authenticated && showHome) {
    return (
      <div className={`landing-page ${themeClass}`}>
        <header className="topbar landing-header">
          <div className="brand-wrap">
            <div className="brand-mark" aria-label="SafetyROI logo">
              <svg viewBox="0 0 32 32" aria-hidden="true">
                <path className="logo-shield" d="M16 2.5 27 6.8v8.1c0 6.8-4.5 11.9-11 14.6C10.5 26.8 6 21.7 6 14.9V6.8L16 2.5Z" />
                <path className="logo-road" d="M13.2 23.4 15.1 10h1.8l1.9 13.4M14.2 17h3.6M14.7 13.5h2.6" />
              </svg>
            </div>
            <div>
              <div className="brand-title">SafetyROI</div>
              <div className="brand-subtitle">Safety Intelligence</div>
            </div>
          </div>

          <nav className="main-nav" aria-label="Main navigation">
            <a href="#features">Features</a>
            <a href="#insights">Insights</a>
            <a href="#workflow">Workflow</a>
          </nav>

          <div className="topbar-actions">
            <button
              className="theme-toggle landing-theme-toggle"
              onClick={() => setDarkMode((prev) => !prev)}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? (
                <svg className="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.6 14.6A8 8 0 0 1 9.4 3.4a9 9 0 1 0 11.2 11.2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <button className="primary-btn" onClick={() => setShowHome(false)}>Sign in</button>
          </div>
        </header>

        <main className="landing-shell">
          <section className="hero-panel landing-hero">
            <div className="hero-copy">
              <div className="hero-badges" aria-label="Platform highlights">
                <span className="floating-chip">Live forecasting</span>
                <span className="floating-chip subtle">AI-powered insights</span>
              </div>
              <div className="eyebrow">Road Safety Intelligence Platform</div>
              <h1>Smarter decisions for safer roads.</h1>
              <p>
                SafetyROI turns traffic, weather, and collision history into clear, explainable guidance for every road safety decision.
              </p>
              <div className="hero-actions">
                <button className="primary-btn" onClick={() => setShowHome(false)}>Access workspace</button>
                <button
                  className="secondary-btn"
                  onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Explore features
                </button>
              </div>
            </div>

            <div className="landing-preview">
              <div className="preview-header">
                <div>
                  <span className="preview-label">Live corridor overview</span>
                  <h3>Delhi • Evening rush</h3>
                </div>
                <span className="preview-badge high">High</span>
              </div>

              <div className="landing-visual">
                <img src={heroIllustration} alt="SafetyROI dashboard overview" />
              </div>

              <div className="preview-stack">
                <div className="preview-row">
                  <span>Risk Score</span>
                  <strong>72%</strong>
                </div>
                <div className="preview-track">
                  <span style={{ width: "72%" }} />
                </div>

                <div className="preview-row">
                  <span>Response time</span>
                  <strong>08 min</strong>
                </div>
                <div className="preview-track short">
                  <span style={{ width: "81%" }} />
                </div>

                <div className="preview-row">
                  <span>Intervention impact</span>
                  <strong>74%</strong>
                </div>
                <div className="preview-track short">
                  <span style={{ width: "74%" }} />
                </div>
              </div>

              <div className="preview-footer">
                <div className="preview-pill">
                  <span className="dot success" /> Ambulance alerted
                </div>
                <div className="preview-pill warning-pill">
                  <span className="dot warning" /> Family notified
                </div>
              </div>
            </div>
          </section>

          <section id="features" className="feature-showcase">
            <div className="feature-intro">
              <div className="eyebrow">Platform capabilities</div>
              <h2>Built for faster, safer road decisions</h2>
            </div>

            <div className="feature-grid">
              <article className="feature-card feature-card-highlight">
                <div className="feature-icon">01</div>
                <h3>Predict risk instantly</h3>
                <p>
                  Run scenario-based forecasts using live traffic, weather, and roadway context to see where danger is rising before it becomes critical.
                </p>
                <ul className="feature-points">
                  <li>Live route intelligence</li>
                  <li>Weather-aware scoring</li>
                  <li>Explainable recommendations</li>
                </ul>
              </article>

              <article className="feature-card">
                <div className="feature-icon">02</div>
                <h3>Spot high-risk zones</h3>
                <p>Highlight accident hotspots, vulnerable corridors, and operational areas that need urgent attention.</p>
              </article>

              <article className="feature-card">
                <div className="feature-icon">03</div>
                <h3>Prioritize interventions</h3>
                <p>See which actions are most likely to reduce crashes with confidence and measurable impact.</p>
              </article>
            </div>
          </section>

          <section id="insights" className="landing-insights panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Decision support</div>
                <h2>The six questions the system answers</h2>
              </div>
            </div>

            <div className="about-grid">
              <div className="about-card">
                <h3>Where</h3>
                <p>Identify corridors and intersections with recurring high collision probability.</p>
              </div>
              <div className="about-card">
                <h3>Why</h3>
                <p>Reveal the dominant causal drivers such as low visibility, high traffic density, and night-time exposure.</p>
              </div>
              <div className="about-card">
                <h3>Who</h3>
                <p>Highlight the most vulnerable users, including pedestrians, cyclists, two-wheelers, and night commuters.</p>
              </div>
              <div className="about-card">
                <h3>When</h3>
                <p>Map the time windows when exposure peaks, such as evening rush periods or rainy night conditions.</p>
              </div>
              <div className="about-card">
                <h3>What first</h3>
                <p>Rank the most effective intervention by urgency, exposure, and expected reduction in severe incidents.</p>
              </div>
              <div className="about-card">
                <h3>Will it work</h3>
                <p>Estimate whether the proposed intervention is likely to lower future crashes at the same corridor.</p>
              </div>
            </div>
          </section>

          <section id="workflow" className="landing-cta panel">
            <div>
              <div className="eyebrow">Ready to begin</div>
              <h2>Open your workspace and start analyzing safer routes.</h2>
            </div>
            <button className="primary-btn" onClick={() => setShowHome(false)}>Continue to login</button>
          </section>
        </main>
      </div>
    );
  }

  if (!authenticated && !showHome) {
    return (
      <div className={`login-page ${themeClass}`}>
        <main className="login-layout">
          <section className="login-intro" aria-label="SafetyROI overview">
            <div className="login-brand" aria-label="SafetyROI brand">
              <div className="brand-mark" aria-label="SafetyROI logo">
                <svg viewBox="0 0 32 32" aria-hidden="true">
                  <path className="logo-shield" d="M16 2.5 27 6.8v8.1c0 6.8-4.5 11.9-11 14.6C10.5 26.8 6 21.7 6 14.9V6.8L16 2.5Z" />
                  <path className="logo-road" d="M13.2 23.4 15.1 10h1.8l1.9 13.4M14.2 17h3.6M14.7 13.5h2.6" />
                </svg>
              </div>
              <div>
                <div className="brand-title">SafetyROI</div>
                <div className="brand-subtitle">AI-Powered Road Safety Intelligence</div>
              </div>
            </div>

            <div className="login-intro-copy">
              <span className="eyebrow">Road safety intelligence platform</span>
              <h1>Make every intervention count.</h1>
              <p>Sign in to your SafetyROI workspace to monitor live risks, prioritize action, and respond faster across critical corridors.</p>
            </div>

            <div className="login-visual" aria-hidden="true">
              <img src={heroIllustration} alt="SafetyROI safety platform illustration" />
            </div>

            <div className="login-proof-list">
              <span><b>01</b> Identify high-risk corridors</span>
              <span><b>02</b> Understand the contributing factors</span>
              <span><b>03</b> Prioritize action with confidence</span>
            </div>
          </section>

          <form
            className="login-card"
            onSubmit={
              authView === "signup"
                ? handleSignup
                : authView === "forgot"
                  ? handleForgotPassword
                  : handleLogin
            }
          >
            <div className="login-card-header">
              <span className="eyebrow">Secure workspace</span>
              <h2>
                {authView === "signup"
                  ? "Create account"
                  : authView === "forgot"
                    ? "Reset password"
                    : "Welcome back"}
              </h2>
              <p>
                {authView === "signup"
                  ? "Set up your SafetyROI workspace and start monitoring road intelligence."
                  : authView === "forgot"
                    ? "Enter your email to receive a secure reset link."
                    : "Sign in to your SafetyROI workspace"}
              </p>
            </div>

            {authView === "signup" && (
              <>
                <label className="login-field">
                  Full name
                  <input
                    type="text"
                    value={loginData.name}
                    onChange={(event) => setLoginData((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Aarav Mehta"
                    autoComplete="name"
                  />
                </label>
                <label className="login-field">
                  Organization
                  <input
                    type="text"
                    value={loginData.organization}
                    onChange={(event) => setLoginData((prev) => ({ ...prev, organization: event.target.value }))}
                    placeholder="City Mobility Department"
                    autoComplete="organization"
                  />
                </label>
                <label className="login-field">
                  Role
                  <input
                    type="text"
                    value={loginData.role}
                    onChange={(event) => setLoginData((prev) => ({ ...prev, role: event.target.value }))}
                    placeholder="Road Safety Analyst"
                    autoComplete="organization-title"
                  />
                </label>
                <label className="login-field">
                  Location
                  <input
                    type="text"
                    value={loginData.location}
                    onChange={(event) => setLoginData((prev) => ({ ...prev, location: event.target.value }))}
                    placeholder="New Delhi, India"
                    autoComplete="address-level2"
                  />
                </label>
              </>
            )}

            <label className="login-field">
              Email address
              <input
                type="email"
                value={loginData.email}
                onChange={(event) => setLoginData((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="you@organization.gov"
                autoComplete="email"
              />
            </label>

            {authView !== "forgot" && (
              <label className="login-field">
                <span className="login-field-label-row">
                  <span>Password</span>
                  <button
                    className="password-toggle"
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={loginData.password}
                  onChange={(event) => setLoginData((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder={authView === "signup" ? "Create a password" : "Enter your password"}
                  autoComplete={authView === "signup" ? "new-password" : "current-password"}
                />
              </label>
            )}

            <div className="login-links">
              <button className="text-link" type="button" onClick={handleOpenForgotPassword}>
                Forgot password?
              </button>
              <button
                className="text-link"
                type="button"
                onClick={authView === "signup" ? handleBackToLogin : handleOpenSignup}
              >
                {authView === "signup" ? "Back to login" : "Sign up"}
              </button>
            </div>

            {loginError && <div className="login-error" role="alert">{loginError}</div>}
            {authNotice && <div className="login-success" role="status">{authNotice}</div>}

            <button
              className="primary-btn login-submit"
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting
                ? authView === "signup"
                  ? "Creating account..."
                  : authView === "forgot"
                    ? "Sending reset link..."
                    : "Signing in..."
                : authView === "signup"
                  ? "Create account"
                  : authView === "forgot"
                    ? "Send reset link"
                    : "Sign In"}
            </button>

            {authView === "login" && (
              <button
                className="login-demo"
                type="button"
                onClick={() => {
                  setLoginData({
                    name: "Aarav Mehta",
                    organization: "City Mobility Department",
                    role: "Road Safety Analyst",
                    location: "New Delhi, India",
                    email: "demo@roadshield.ai",
                    password: "demo",
                  });
                  setLoginError("");
                  setAuthNotice("");
                }}
              >
                Demo Workspace
              </button>
            )}
          </form>
        </main>
      </div>
    );
  }

  if (showMapPage) {
    return (
      <div className={`container ${themeClass}`}>
        <header className="topbar">
          <div className="brand-wrap">
            <div className="brand-mark" aria-label="SafetyROI logo">
              <svg viewBox="0 0 32 32" aria-hidden="true">
                <path className="logo-shield" d="M16 2.5 27 6.8v8.1c0 6.8-4.5 11.9-11 14.6C10.5 26.8 6 21.7 6 14.9V6.8L16 2.5Z" />
                <path className="logo-road" d="M13.2 23.4 15.1 10h1.8l1.9 13.4M14.2 17h3.6M14.7 13.5h2.6" />
              </svg>
            </div>
            <div>
              <div className="brand-title">SafetyROI</div>
              <div className="brand-subtitle">Safety Intelligence</div>
            </div>
          </div>

          <nav className="main-nav" aria-label="Main navigation">
            <a href="#dashboard" onClick={(event) => {
              event.preventDefault();
              handleBackToDashboard();
            }}>Dashboard</a>
            <a href="#risk-form" onClick={(event) => {
              event.preventDefault();
              handleBackToDashboard();
            }}>Risk Prediction</a>
          </nav>

          <div className="topbar-actions">
            <button
              className="theme-toggle"
              onClick={() => setDarkMode((prev) => !prev)}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? (
                <svg className="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.6 14.6A8 8 0 0 1 9.4 3.4a9 9 0 1 0 11.2 11.2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <button className="secondary-btn" onClick={handleBackToDashboard}>Back to dashboard</button>
          </div>
        </header>

        <main className="dashboard-shell">
          <section className="panel map-panel page-map-panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Hotspot Intelligence</div>
                <h2>High-risk corridors and collision drivers</h2>
              </div>
            </div>
            <HotspotMap />
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className={`container ${themeClass}`}>
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark" aria-label="SafetyROI logo">
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <path className="logo-shield" d="M16 2.5 27 6.8v8.1c0 6.8-4.5 11.9-11 14.6C10.5 26.8 6 21.7 6 14.9V6.8L16 2.5Z" />
              <path className="logo-road" d="M13.2 23.4 15.1 10h1.8l1.9 13.4M14.2 17h3.6M14.7 13.5h2.6" />
            </svg>
          </div>
          <div>
            <div className="brand-title">SafetyROI</div>
            <div className="brand-subtitle">Safety Intelligence</div>
          </div>
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          <a href="#dashboard">Dashboard</a>
          <a href="#risk-form">Risk Prediction</a>
          <a href="#risk-map" onClick={(event) => {
            event.preventDefault();
            handleOpenMapPage();
          }}>Risk Map</a>
          <a href="#interventions">Interventions</a>
          <a href="#history">History</a>
          <a href="#about">About</a>
        </nav>

        <div className="topbar-actions">
          <button
            className="theme-toggle"
            onClick={() => setDarkMode((prev) => !prev)}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? (
              <svg className="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
                <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.6 14.6A8 8 0 0 1 9.4 3.4a9 9 0 1 0 11.2 11.2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          {/* <span className="status-pill">
            <span className="status-dot" /> System Online
          </span> */}
          <button className="profile-pill" onClick={() => setProfileOpen((prev) => !prev)} aria-label="Open profile details" title="Profile details">
            {(profile?.name || "AI").slice(0, 1).toUpperCase()}
          </button>
          {profileOpen && (
            <div className="profile-menu">
              <div className="profile-menu-heading">
                <div className="profile-avatar">{(profile?.name || "AI").slice(0, 1).toUpperCase()}</div>
                <div>
                  <strong>{profile?.name || "Road Safety Analyst"}</strong>
                  <span>{profile?.role || "Safety Intelligence Analyst"}</span>
                </div>
              </div>
              <div className="profile-details">
                <div><span>Email</span><strong>{profile?.email || "demo@roadshield.ai"}</strong></div>
                <div><span>Organization</span><strong>{profile?.organization || "Road Safety Operations"}</strong></div>
                <div><span>Location</span><strong>{profile?.location || "India"}</strong></div>
              </div>
              <button className="profile-signout" onClick={() => {
                sessionStorage.removeItem("roadshield-session");
                sessionStorage.removeItem("roadshield-profile");
                setAuthenticated(false);
                setShowHome(true);
                setProfileOpen(false);
              }}>Sign out</button>
            </div>
          )}
        </div>
      </header>

      <main className="dashboard-shell" id="dashboard">
        <section className="hero-panel">
          <div className="hero-copy">
            <div className="hero-badges" aria-label="Platform highlights">
              <span className="floating-chip">Live forecasting</span>
              <span className="floating-chip subtle">AI-powered insights</span>
            </div>
            <div className="eyebrow">Road Safety Intelligence System</div>
            <h1>Operational Road Safety Intelligence</h1>
            <p>
              Detect where accidents are most likely, explain why they happen, identify vulnerable road users, and prioritize the intervention most likely to reduce crashes.
            </p>
            <div className="hero-actions">
              <button className="primary-btn" onClick={() => document.getElementById("risk-form")?.scrollIntoView({ behavior: "smooth" })}>
                Assess Safety Risk
              </button>
              <button className="secondary-btn" onClick={handleOpenMapPage}>
                Review Hotspots
              </button>
            </div>
          </div>

          <div className="hero-metrics">
            <div className="mini-stat stat-1">
              <span className="mini-label">Incident Likelihood</span>
              <strong>{currentRiskScore.toFixed(0)}%</strong>
              <small>{currentRiskLevel}</small>
            </div>
            <div className="mini-stat stat-2">
              <span className="mini-label">Hotspot Corridors</span>
              <strong>18</strong>
              <small>Active</small>
            </div>
            <div className="mini-stat stat-3">
              <span className="mini-label">Vulnerable Groups</span>
              <strong>5</strong>
              <small>Priority</small>
            </div>
            <div className="mini-stat stat-4">
              <span className="mini-label">Intervention Impact</span>
              <strong>74%</strong>
              <small>Predicted reduction</small>
            </div>
          </div>
        </section>

        <section className="panel" id="risk-form">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Safety Intelligence Engine</div>
              <h2>Assess road conditions</h2>
            </div>
          </div>

          <div className="scenario-row" aria-label="Demo scenarios">
            {DEMO_SCENARIOS.map((scenario) => (
              <button key={scenario.id} className="scenario-btn" onClick={() => applyScenario(scenario)}>
                {scenario.label}
              </button>
            ))}
          </div>

          <div className="form-grid">
            <div className="field-group">
              <h3>Location</h3>
              <label>
                City
                <select name="city" value={formData.city} onChange={handleChange}>
                  <option>Delhi</option>
                  <option>Mumbai</option>
                  <option>Bangalore</option>
                  <option>Chennai</option>
                  <option>Hyderabad</option>
                  <option>Kolkata</option>
                  <option>Pune</option>
                  <option>Chandigarh</option>
                </select>
              </label>

              <label>
                Road Type
                <select name="road_type" value={formData.road_type} onChange={handleChange}>
                  <option value="urban">Urban</option>
                  <option value="highway">Highway</option>
                  <option value="rural">Rural</option>
                </select>
              </label>
            </div>

            <div className="field-group">
              <h3>Road Conditions</h3>
              <label>
                Traffic Density
                <select name="traffic_density" value={formData.traffic_density} onChange={handleChange}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>

              <label>
                Visibility (km)
                <input type="number" min="0" max="20" name="visibility" value={formData.visibility} onChange={handleNumericChange} />
              </label>

              <label>
                Lanes
                <input type="number" min="1" max="12" name="lanes" value={formData.lanes} onChange={handleNumericChange} />
              </label>
            </div>

            <div className="field-group">
              <h3>Environmental</h3>
              <label>
                Weather
                <select name="weather" value={formData.weather} onChange={handleChange}>
                  <option value="clear">Clear</option>
                  <option value="fog">Fog</option>
                  <option value="rain">Rain</option>
                </select>
              </label>

              <label>
                Temperature (°C)
                <input type="number" name="temperature" value={formData.temperature} onChange={handleNumericChange} />
              </label>

              <label>
                Vehicles Involved
                <input type="number" min="1" max="10" name="vehicles_involved" value={formData.vehicles_involved} onChange={handleNumericChange} />
              </label>
            </div>

            <div className="field-group">
              <h3>Time Conditions</h3>
              <label>
                Hour
                <input type="number" min="0" max="23" name="hour" value={formData.hour} onChange={handleNumericChange} />
              </label>

              <label>
                Day of Week
                <select name="day_of_week" value={formData.day_of_week} onChange={handleChange}>
                  <option>Monday</option>
                  <option>Tuesday</option>
                  <option>Wednesday</option>
                  <option>Thursday</option>
                  <option>Friday</option>
                  <option>Saturday</option>
                  <option>Sunday</option>
                </select>
              </label>

              <label>
                Peak Hour
                <select name="is_peak_hour" value={formData.is_peak_hour} onChange={handleChange}>
                  <option value={1}>Yes</option>
                  <option value={0}>No</option>
                </select>
              </label>
            </div>
          </div>

          <div className="action-row">
            <button className="primary-btn" onClick={predictRisk} disabled={loading}>
              {loading ? "Analyzing road conditions..." : "Analyze Risk"}
            </button>
            <button className="secondary-btn" onClick={() => setFormData(DEFAULT_FORM)}>
              Reset
            </button>
          </div>

          {error && (
            <div className="error-banner" role="alert">
              <span>⚠</span>
              <span>{error}</span>
              <button className="inline-link" onClick={predictRisk}>Retry</button>
            </div>
          )}

          {loading && (
            <div className="loading-box" aria-live="polite">
              <div className="spinner" />
              <span>Analyzing road conditions...</span>
            </div>
          )}
        </section>

        <section className="kpi-grid" aria-label="Dashboard metrics">
          <article className="kpi-card accent">
            <div className="kpi-header">
              <span>Risk Probability</span>
              <span className={`pill ${toRiskTone(currentRiskScore)}`}>{currentRiskLevel}</span>
            </div>
            <div className="kpi-value">{currentRiskScore.toFixed(0)}%</div>
            <div className="kpi-trend positive">Forecast confidence stable</div>
          </article>

          <article className="kpi-card">
            <div className="kpi-header">
              <span>Hotspot Zones</span>
              <span className="tiny-badge">Live</span>
            </div>
            <div className="kpi-value">18</div>
            <div className="kpi-trend">Across 7 districts</div>
          </article>

          <article className="kpi-card">
            <div className="kpi-header">
              <span>Priority Interventions</span>
              <span className="tiny-badge warning">5</span>
            </div>
            <div className="kpi-value">5</div>
            <div className="kpi-trend">2 weather-driven</div>
          </article>

          <article className="kpi-card">
            <div className="kpi-header">
              <span>Expected Impact</span>
              <span className="tiny-badge neutral">-74%</span>
            </div>
            <div className="kpi-value">74%</div>
            <div className="kpi-trend">Reduction in crashes</div>
          </article>
        </section>

        {result && (
          <section className="panel result-panel" aria-live="polite">
            <div className="panel-header">
              <div>
                <div className="eyebrow">AI Result</div>
                <h2>Risk Assessment and Intervention Priority</h2>
              </div>
            </div>

            <div className="result-grid">
              <div className="gauge-card">
                <div className={`gauge-shell ${toRiskTone(currentRiskScore)}`}>
                  <div className="gauge-ring">
                    <div className="gauge-center">
                      <strong>{currentRiskScore.toFixed(0)}%</strong>
                      <span>{currentRiskLevel}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="result-summary">
                <div className={`risk-pill ${toRiskTone(currentRiskScore)}`}>{result.risk_level}</div>
                <h3>Risk Level: {result.risk_level}</h3>
                <p>{result.explanation}</p>

                <div className="score-meta">
                  <div>
                    <label>Location</label>
                    <strong>{formData.city}</strong>
                  </div>
                  <div>
                    <label>Weather</label>
                    <strong>{formData.weather}</strong>
                  </div>
                  <div>
                    <label>Traffic</label>
                    <strong>{formData.traffic_density}</strong>
                  </div>
                </div>
              </div>

              <div className="risk-factor-panel">
                <h3>Why this corridor is risky</h3>
                {riskFactorEntries.map((factor) => (
                  <div key={factor.label} className="factor-item">
                    <div className="factor-row">
                      <span>{factor.label}</span>
                      <strong>{factor.value.toFixed(1)}%</strong>
                    </div>
                    <div className="factor-bar">
                      <span style={{ width: `${factor.value}%` }} />
                    </div>
                    <p>{factor.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {result && (
          <section className="panel recommendation-panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Intervention Strategy</div>
                <h2>Recommended action sequence</h2>
              </div>
            </div>

            <div className="recommendation-grid">
              {result.recommendations?.map((tip, index) => (
                <div key={`${tip}-${index}`} className="recommendation-card">
                  <span className="recommendation-icon">✓</span>
                  <p>{tip}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="panel emergency-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Emergency Response</div>
              <h2>Accident notification flow</h2>
            </div>
            <button className="primary-btn" onClick={triggerEmergencyAlert}>Trigger alert</button>
          </div>

          {emergencyAlert ? (
            <div className="emergency-grid">
              <article className="alert-card">
                <span className="alert-badge">Family contact</span>
                <h3>SMS + push notification</h3>
                <p>{emergencyAlert.familyNotice}</p>
              </article>

              <article className="alert-card">
                <span className="alert-badge warning">Ambulance driver</span>
                <h3>Nearby ambulance alert</h3>
                <p>{emergencyAlert.ambulanceNotice}</p>
              </article>

              <article className="alert-card">
                <span className="alert-badge danger">Phone call</span>
                <h3>Emergency call coordination</h3>
                <p>{emergencyAlert.phoneCall}</p>
              </article>
            </div>
          ) : (
            <div className="empty-state">
              No active incident alert yet. Use the button above to simulate a crash alert and notify the registered family and nearby ambulance services.
            </div>
          )}

          {emergencyAlert && (
            <div className="emergency-summary">
              <span className="status-pill">
                <span className="status-dot" /> {emergencyAlert.timestamp}
              </span>
              <span className="route-badge high">{emergencyAlert.level}</span>
              <span className="history-weather">{emergencyAlert.location}</span>
            </div>
          )}
        </section>

        <section className="panel route-panel" id="interventions">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Intervention Planning</div>
              <h2>Compare safer access options</h2>
            </div>
          </div>

          <div className="route-grid">
            {routeComparison.map((route) => (
              <div key={route.route} className="route-card">
                <div className="route-head">
                  <strong>{route.route}</strong>
                  <span className={`route-badge ${toRiskTone(route.risk)}`}>{route.risk}%</span>
                </div>
                <div className="route-meta">
                  <span>Traffic: {route.traffic}</span>
                  <span>ETA: {route.eta}</span>
                </div>
                <p>{route.note}</p>
              </div>
            ))}
          </div>

          <div className="recommended-route">
            <div className="eyebrow">Recommended safer route</div>
            <h3>Route B</h3>
            <p>Lower estimated crash risk despite a slightly longer travel time, making it the preferred route for risk-sensitive travel.</p>
          </div>
        </section>

        <section className="panel history-panel" id="history">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Operational History</div>
              <h2>Recent risk assessments</h2>
            </div>
          </div>

          {history.length === 0 ? (
            <div className="empty-state">No recent predictions yet. Run a risk analysis to build your history.</div>
          ) : (
            <div className="history-list">
              {history.map((entry) => (
                <div key={entry.id} className="history-item">
                  <div>
                    <strong>{new Date(entry.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</strong>
                    <span>{entry.city}</span>
                  </div>
                  <div className="history-score">{entry.score}%</div>
                  <div className={`history-level ${toRiskTone(entry.score)}`}>{entry.level}</div>
                  <div className="history-weather">{entry.weather}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel intelligence-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Decision Support</div>
              <h2>The six questions the system answers</h2>
            </div>
          </div>

          <div className="about-grid">
            <div className="about-card">
              <h3>Where</h3>
              <p>Identify corridors and intersections with recurring high collision probability.</p>
            </div>
            <div className="about-card">
              <h3>Why</h3>
              <p>Reveal the dominant causal drivers such as low visibility, high traffic density, and night-time exposure.</p>
            </div>
            <div className="about-card">
              <h3>Who</h3>
              <p>Highlight the most vulnerable users, including pedestrians, cyclists, two-wheelers, and night commuters.</p>
            </div>
            <div className="about-card">
              <h3>When</h3>
              <p>Map the time windows when exposure peaks, such as evening rush periods or rainy night conditions.</p>
            </div>
            <div className="about-card">
              <h3>What first</h3>
              <p>Rank the most effective intervention by urgency, exposure, and expected reduction in severe incidents.</p>
            </div>
            <div className="about-card">
              <h3>Will it work</h3>
              <p>Estimate whether the proposed intervention is likely to lower future crashes at the same corridor.</p>
            </div>
          </div>
        </section>

        <section className="panel about-panel" id="about">
          <div className="panel-header">
            <div>
              <div className="eyebrow">About</div>
              <h2>How SafetyROI works</h2>
            </div>
          </div>

          <div className="about-grid">
            <div className="about-card">
              <h3>Problem</h3>
              <p>Authorities need to know where collisions cluster, why they occur, and which interventions will reduce harm most quickly.</p>
            </div>
            <div className="about-card">
              <h3>Solution</h3>
              <p>SafetyROI converts historical and live conditions into an operational decision-support layer for safer roads and faster response.</p>
            </div>
            <div className="about-card">
              <h3>Workflow</h3>
              <p>Conditions → hotspot detection → causal diagnosis → vulnerable user analysis → intervention priority → outcome prediction</p>
            </div>
          </div>
        </section>

      </main>


      <footer className="footer">Built with React • FastAPI • Scikit-Learn • Render</footer>
    </div>
  );
}

export default App;