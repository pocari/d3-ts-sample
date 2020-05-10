import React from 'react';
import './App.css';
import MapSample from 'MapSample';

function App() {
  return (
    <div className="App">
      <MapSample
        url="output_topo_0.json"
        objectsname="ne_110m_admin_0_countries"
      />
    </div>
  );
}

export default App;
