import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'; // Import getFirestore even if not directly used for data persistence in this specific app

// Assurez-vous que ces variables globales sont disponibles dans l'environnement Canvas
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

function App() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userId, setUserId] = useState(null);

  // Initialisation de Firebase et gestion de l'authentification
  useEffect(() => {
    let app, db, auth;
    try {
      app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      auth = getAuth(app);

      // Écouteur de l'état d'authentification
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          // Si l'utilisateur n'est pas authentifié, essayez de vous connecter de manière anonyme
          try {
            await signInAnonymously(auth);
            setUserId(auth.currentUser?.uid || crypto.randomUUID()); // Fallback for anonymous
          } catch (error) {
            console.error("Erreur de connexion anonyme:", error);
            setMessage("Erreur de connexion anonyme. Certaines fonctionnalités peuvent être limitées.");
            setUserId(crypto.randomUUID()); // Fallback if anonymous sign-in fails
          }
        }
        setIsAuthReady(true); // L'état d'authentification est prêt
      });

      // Si un jeton d'authentification initial est fourni, utilisez-le
      const authenticateWithToken = async () => {
        if (initialAuthToken) {
          try {
            await signInWithCustomToken(auth, initialAuthToken);
          } catch (error) {
            console.error("Erreur de connexion avec le jeton personnalisé:", error);
            setMessage("Erreur de connexion avec le jeton personnalisé. Tentative de connexion anonyme.");
            await signInAnonymously(auth); // Fallback to anonymous
          }
        } else {
          // Si aucun jeton n'est fourni, connectez-vous anonymement
          await signInAnonymously(auth);
        }
      };

      authenticateWithToken();

      return () => unsubscribe(); // Nettoyage de l'écouteur
    } catch (error) {
      console.error("Erreur d'initialisation de Firebase:", error);
      setMessage("Erreur d'initialisation de l'application. Veuillez réessayer.");
      setIsAuthReady(true); // Marquer comme prêt même en cas d'erreur pour éviter le blocage
    }
  }, []);

  // Fonction pour afficher les messages
  const showMessage = (msg, type = 'info') => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000); // Efface le message après 5 secondes
  };

  // Fonction de résumé
  const summarizeText = async () => {
    if (!transcriptText.trim()) {
      showMessage('Veuillez coller la transcription de la vidéo pour la résumer.', 'error');
      return;
    }

    setIsLoading(true);
    setSummary('');
    setMessage('');

    try {
      let chatHistory = [];
      const prompt = `Veuillez résumer le texte suivant d'une vidéo YouTube en français. Fournissez un résumé concis et clair qui capture les points principaux et les idées clés. Le résumé doit être facile à lire et à comprendre. Voici le texte : \n\n${transcriptText}`;
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });

      const payload = { contents: chatHistory };
      const apiKey = ""; // La clé API sera injectée par l'environnement Canvas
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Erreur API: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const text = result.candidates[0].content.parts[0].text;
        setSummary(text);
        showMessage('Résumé généré avec succès !', 'success');
      } else {
        showMessage('Aucun résumé n\'a pu être généré. Veuillez réessayer.', 'error');
        console.error('Structure de réponse inattendue:', result);
      }
    } catch (error) {
      console.error('Erreur lors de la génération du résumé:', error);
      showMessage(`Erreur lors de la génération du résumé: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-indigo-200 p-4 sm:p-6 font-sans flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8 w-full max-w-3xl border border-purple-200">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-purple-800 mb-6">
          SumDLB - Résumez vos vidéos YouTube
        </h1>

        {userId && (
          <p className="text-sm text-gray-600 text-center mb-4">
            ID Utilisateur: <span className="font-mono bg-gray-100 px-2 py-1 rounded-md text-purple-700 break-all">{userId}</span>
          </p>
        )}

        {message && (
          <div className={`p-3 mb-4 rounded-lg text-sm font-medium ${message.includes('Erreur') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}

        <div className="mb-6">
          <label htmlFor="youtube-url" className="block text-gray-700 text-sm font-bold mb-2">
            URL de la vidéo YouTube (non utilisée pour l'extraction) :
          </label>
          <input
            type="text"
            id="youtube-url"
            className="shadow-sm appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200"
            placeholder="Ex: https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
          />
        </div>

        <div className="mb-6">
          <label htmlFor="transcript-text" className="block text-gray-700 text-sm font-bold mb-2">
            Collez la transcription de la vidéo ici :
          </label>
          <textarea
            id="transcript-text"
            className="shadow-sm appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 h-48 resize-y"
            placeholder="Copiez et collez le texte de la transcription de la vidéo YouTube ici..."
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
          ></textarea>
          <p className="text-xs text-gray-500 mt-1">
            (Pour obtenir la transcription, ouvrez la vidéo YouTube, cliquez sur les trois points sous la vidéo, puis sur "Afficher la transcription". Copiez le texte et collez-le ici.)
          </p>
        </div>

        <button
          onClick={summarizeText}
          disabled={isLoading || !isAuthReady}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            'Résumer la vidéo'
          )}
        </button>

        {summary && (
          <div className="mt-8 bg-purple-50 p-6 rounded-xl border border-purple-300 shadow-inner">
            <h2 className="text-2xl font-bold text-purple-700 mb-4">Résumé :</h2>
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
