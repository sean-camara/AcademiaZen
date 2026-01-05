import React from 'react';
import { ZenProvider } from './context/ZenContext';
import Layout from './components/Layout';

const App: React.FC = () => {
  return (
    <ZenProvider>
      <Layout />
    </ZenProvider>
  );
};

export default App;