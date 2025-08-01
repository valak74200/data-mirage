import React from 'react';
import type { Dataset, ProcessingResult } from '@shared/types';

interface DatasetStatsProps {
  dataset: Dataset;
  processingResult?: ProcessingResult;
}

export default function DatasetStats({ dataset, processingResult }: DatasetStatsProps) {
  const data = Array.isArray(dataset.originalData) ? dataset.originalData : [];
  const columns = data.length > 0 ? Object.keys(data[0] || {}) : [];
  
  // Calculate basic statistics
  const stats = {
    rows: data.length,
    columns: columns.length,
    numericColumns: columns.filter(col => 
      data.some(row => typeof row?.[col] === 'number' && !isNaN(row[col]))
    ).length,
    textColumns: columns.filter(col => 
      data.some(row => typeof row?.[col] === 'string')
    ).length,
    nullValues: columns.reduce((total, col) => 
      total + data.filter(row => row?.[col] == null || row?.[col] === '').length, 0
    )
  };

  const completeness = ((stats.rows * stats.columns - stats.nullValues) / (stats.rows * stats.columns) * 100).toFixed(1);

  return (
    <div className="space-y-4">
      {/* Dataset Overview */}
      <div className="glass-panel p-4 border border-cyan-500/20 rounded-lg">
        <h3 className="text-sm font-bold text-cyan-400 mb-3">📊 APERÇU DU DATASET</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Nom:</span>
            <span className="text-white font-mono truncate ml-2">{dataset.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Lignes:</span>
            <span className="text-green-400 font-mono">{stats.rows.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Colonnes:</span>
            <span className="text-blue-400 font-mono">{stats.columns}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Complétude:</span>
            <span className={`font-mono ${parseFloat(completeness) > 90 ? 'text-green-400' : parseFloat(completeness) > 70 ? 'text-yellow-400' : 'text-red-400'}`}>
              {completeness}%
            </span>
          </div>
        </div>
      </div>

      {/* Column Types */}
      <div className="glass-panel p-4 border border-green-500/20 rounded-lg">
        <h3 className="text-sm font-bold text-green-400 mb-3">🔢 TYPES DE DONNÉES</h3>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Colonnes numériques:</span>
            <span className="text-blue-400 font-mono">{stats.numericColumns}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Colonnes texte:</span>
            <span className="text-purple-400 font-mono">{stats.textColumns}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Valeurs manquantes:</span>
            <span className={`font-mono ${stats.nullValues > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
              {stats.nullValues.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Processing Results */}
      {processingResult && (
        <div className="glass-panel p-4 border border-violet-500/20 rounded-lg">
          <h3 className="text-sm font-bold text-violet-400 mb-3">🤖 RÉSULTATS ML</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Points visualisés:</span>
              <span className="text-white font-mono">{processingResult.points?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Clusters trouvés:</span>
              <span className="text-green-400 font-mono">{processingResult.clusters?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Anomalies détectées:</span>
              <span className="text-red-400 font-mono">
                {processingResult.points?.filter(p => p.isAnomaly).length || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Méthode réduction:</span>
              <span className="text-cyan-400 font-mono uppercase">t-SNE</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Algorithme clustering:</span>
              <span className="text-cyan-400 font-mono uppercase">K-MEANS</span>
            </div>
          </div>
        </div>
      )}

      {/* Column Details */}
      <div className="glass-panel p-4 border border-gray-500/20 rounded-lg max-h-48 overflow-y-auto">
        <h3 className="text-sm font-bold text-gray-400 mb-3">📋 COLONNES DÉTAILLÉES</h3>
        <div className="space-y-1">
          {columns.slice(0, 10).map((column, index) => {
            const sampleValues = data.slice(0, 3).map((row: any) => row?.[column]).filter((val: any) => val != null);
            const isNumeric = sampleValues.some((val: any) => typeof val === 'number');
            
            return (
              <div key={index} className="text-xs border-b border-gray-700/30 pb-1">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 font-mono">{column}</span>
                  <span className={`px-1 rounded text-xs ${isNumeric ? 'bg-blue-600/20 text-blue-400' : 'bg-purple-600/20 text-purple-400'}`}>
                    {isNumeric ? 'NUM' : 'TEXT'}
                  </span>
                </div>
                {sampleValues.length > 0 && (
                  <div className="text-gray-500 mt-1 truncate">
                    Exemples: {sampleValues.slice(0, 2).map((val: any) => String(val)).join(', ')}
                  </div>
                )}
              </div>
            );
          })}
          {columns.length > 10 && (
            <div className="text-xs text-gray-500 italic pt-2">
              ... et {columns.length - 10} autres colonnes
            </div>
          )}
        </div>
      </div>
    </div>
  );
}