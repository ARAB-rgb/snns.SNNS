import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

function GlobalAppRunner() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleErr = (event: ErrorEvent) => {
      console.error('Captured Global Error:', event.error);
      setErrorMsg(event.message || 'Error occurred');
    };
    window.addEventListener('error', handleErr);
    return () => window.removeEventListener('error', handleErr);
  }, []);

  if (errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dir-rtl font-sans p-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            !
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">تطبيق SNNS</h2>
          <p className="text-sm text-gray-600 mb-6">
            حدث خطأ أثناء تحميل التطبيق. يرجى تحديث الصفحة.
          </p>
          <p className="text-xs text-red-500 font-mono bg-red-50 p-3 rounded-lg mb-6 text-right overflow-x-auto">
            {errorMsg}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition shadow-md"
          >
            إعادة تحميل التطبيق
          </button>
        </div>
      </div>
    );
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalAppRunner />
  </StrictMode>
);
