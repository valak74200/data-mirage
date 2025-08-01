/**
 * PerformanceComparison - Test de performance du nouveau Canvas3D vs anciens composants
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Canvas3D from '../index';
import { useFPSMonitor } from '../hooks/usePerformance';
import { DeviceCapabilityDetector } from '../utils/performance';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Monitor,
  Smartphone,
  Zap,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

// Generate test data
function generateTestData(pointCount: number) {
  const points = [];
  const clusters = [];
  const clusterCount = Math.min(10, Math.floor(pointCount / 100));

  // Generate clusters
  for (let i = 0; i < clusterCount; i++) {
    clusters.push({
      id: i,
      color: `hsl(${(i * 360) / clusterCount}, 70%, 60%)`,
      center: [
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100
      ] as [number, number, number],
      points: []
    });
  }

  // Generate points
  for (let i = 0; i < pointCount; i++) {
    const clusterId = Math.floor(Math.random() * clusterCount);
    const cluster = clusters[clusterId];
    
    const point = {
      id: `point-${i}`,
      position: [
        cluster.center[0] + (Math.random() - 0.5) * 20,
        cluster.center[1] + (Math.random() - 0.5) * 20,
        cluster.center[2] + (Math.random() - 0.5) * 20
      ] as [number, number, number],
      color: cluster.color,
      size: Math.random() * 8 + 2,
      cluster: clusterId,
      isAnomaly: Math.random() < 0.05, // 5% anomalies
      originalData: {
        index: i,
        value: Math.random() * 100,
        category: `Category ${Math.floor(Math.random() * 5)}`,
        timestamp: Date.now() + i * 1000
      }
    };

    points.push(point);
    cluster.points.push(point.id);
  }

  return { points, clusters, anomalies: points.filter(p => p.isAnomaly).map(p => p.id) };
}

interface TestResult {
  pointCount: number;
  avgFPS: number;
  frameTime: number;
  memoryUsage: number;
  renderTime: number;
  passed: boolean;
  score: number;
}

interface PerformanceTestProps {
  onResults: (results: TestResult[]) => void;
}

function PerformanceTest({ onResults }: PerformanceTestProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState(0);
  const [results, setResults] = useState<TestResult[]>([]);
  const [testData, setTestData] = useState<any>(null);
  
  const { fps, frameTime } = useFPSMonitor();
  const metricsRef = useRef<number[]>([]);
  const testTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const testCases = [
    { pointCount: 1000, duration: 5000, targetFPS: 60 },
    { pointCount: 5000, duration: 5000, targetFPS: 45 },
    { pointCount: 10000, duration: 5000, targetFPS: 30 },
    { pointCount: 25000, duration: 5000, targetFPS: 20 },
    { pointCount: 50000, duration: 5000, targetFPS: 15 }
  ];

  const runTest = async (testCase: typeof testCases[0]) => {
    return new Promise<TestResult>((resolve) => {
      const data = generateTestData(testCase.pointCount);
      setTestData(data);
      
      metricsRef.current = [];
      let memoryStart = 0;
      
      // Start memory monitoring
      if ('memory' in performance) {
        memoryStart = (performance as any).memory.usedJSHeapSize;
      }

      const startTime = performance.now();
      
      // Collect metrics during test
      const collectMetrics = () => {
        metricsRef.current.push(fps);
      };
      
      const metricsInterval = setInterval(collectMetrics, 100);
      
      testTimeoutRef.current = setTimeout(() => {
        clearInterval(metricsInterval);
        
        const endTime = performance.now();
        const avgFPS = metricsRef.current.reduce((sum, f) => sum + f, 0) / metricsRef.current.length;
        const renderTime = endTime - startTime;
        
        let memoryUsage = 0;
        if ('memory' in performance) {
          memoryUsage = (performance as any).memory.usedJSHeapSize - memoryStart;
        }
        
        const passed = avgFPS >= testCase.targetFPS;
        const score = Math.min(100, (avgFPS / testCase.targetFPS) * 100);
        
        const result: TestResult = {
          pointCount: testCase.pointCount,
          avgFPS: Math.round(avgFPS),
          frameTime: Math.round(frameTime * 100) / 100,
          memoryUsage: Math.round(memoryUsage / 1024 / 1024), // MB
          renderTime: Math.round(renderTime),
          passed,
          score: Math.round(score)
        };
        
        resolve(result);
      }, testCase.duration);
    });
  };

  const startTests = async () => {
    setIsRunning(true);
    setResults([]);
    setCurrentTest(0);
    
    const testResults: TestResult[] = [];
    
    for (let i = 0; i < testCases.length; i++) {
      setCurrentTest(i);
      const result = await runTest(testCases[i]);
      testResults.push(result);
      setResults([...testResults]);
      
      // Break early if performance is too poor
      if (result.avgFPS < 10) {
        console.log('Stopping tests due to poor performance');
        break;
      }
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    setIsRunning(false);
    onResults(testResults);
  };

  const stopTests = () => {
    if (testTimeoutRef.current) {
      clearTimeout(testTimeoutRef.current);
    }
    setIsRunning(false);
  };

  useEffect(() => {
    return () => {
      if (testTimeoutRef.current) {
        clearTimeout(testTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Test Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            onClick={startTests}
            disabled={isRunning}
            className="flex items-center space-x-2"
          >
            <Play className="w-4 h-4" />
            <span>Lancer les tests</span>
          </Button>
          
          {isRunning && (
            <Button
              onClick={stopTests}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Square className="w-4 h-4" />
              <span>Arrêter</span>
            </Button>
          )}
        </div>

        {isRunning && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400">
              Test {currentTest + 1}/{testCases.length}
            </span>
            <Progress 
              value={(currentTest / testCases.length) * 100} 
              className="w-32" 
            />
          </div>
        )}
      </div>

      {/* Current Test Display */}
      {isRunning && testData && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium">
              Test en cours: {testCases[currentTest].pointCount} points
            </h4>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">{fps} FPS</Badge>
              <Badge variant="outline">{frameTime.toFixed(1)}ms</Badge>
            </div>
          </div>
          
          <div className="h-64 bg-gray-900 rounded-lg overflow-hidden">
            <Canvas3D
              data={testData}
              config={{
                renderer: 'canvas2d',
                performance: 'balanced',
                features: ['clustering', 'anomalies']
              }}
              ui={{
                showLegend: false,
                showStats: false,
                showControls: false
              }}
            />
          </div>
        </Card>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium mb-4">Résultats des tests</h4>
          <div className="space-y-2">
            {results.map((result, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {result.passed ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className="font-medium">
                    {result.pointCount.toLocaleString()} points
                  </span>
                </div>
                
                <div className="flex items-center space-x-4 text-sm">
                  <div className="text-center">
                    <div className="text-gray-500">FPS</div>
                    <div className={result.avgFPS >= testCases[index].targetFPS ? 'text-green-600' : 'text-red-600'}>
                      {result.avgFPS}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500">Frame</div>
                    <div>{result.frameTime}ms</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500">Mémoire</div>
                    <div>{result.memoryUsage}MB</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500">Score</div>
                    <div className={result.score >= 80 ? 'text-green-600' : result.score >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                      {result.score}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default function PerformanceComparison() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);

  useEffect(() => {
    const info = {
      deviceClass: DeviceCapabilityDetector.getDeviceClass(),
      isMobile: DeviceCapabilityDetector.isMobile(),
      supportsWebGL2: DeviceCapabilityDetector.supportsWebGL2(),
      recommendedSettings: DeviceCapabilityDetector.getRecommendedSettings(),
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as any).deviceMemory
    };
    setDeviceInfo(info);

    // Cleanup function to dispose device capability detector
    return () => {
      DeviceCapabilityDetector.dispose();
    };
  }, []);

  const getOverallScore = () => {
    if (results.length === 0) return 0;
    return Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);
  };

  const getRecommendation = () => {
    const score = getOverallScore();
    if (score >= 80) return 'Excellent - Toutes les fonctionnalités peuvent être activées';
    if (score >= 60) return 'Bon - Mode balanced recommandé';
    if (score >= 40) return 'Moyen - Mode mobile recommandé';
    return 'Faible - Réduire le nombre de points ou désactiver certaines fonctionnalités';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Test de Performance Canvas3D</h1>
        <p className="text-gray-600">
          Évaluation des performances du nouveau composant 3D unifié
        </p>
      </div>

      {/* Device Info */}
      {deviceInfo && (
        <Card className="p-4">
          <h3 className="font-medium mb-3">Informations du dispositif</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Classe d'appareil</div>
              <div className="flex items-center space-x-1">
                {deviceInfo.deviceClass === 'high-end' && <Monitor className="w-4 h-4" />}
                {deviceInfo.deviceClass === 'mid-range' && <Zap className="w-4 h-4" />}
                {deviceInfo.deviceClass === 'low-end' && <Smartphone className="w-4 h-4" />}
                <span className="capitalize">{deviceInfo.deviceClass}</span>
              </div>
            </div>
            <div>
              <div className="text-gray-500">Type</div>
              <div>{deviceInfo.isMobile ? 'Mobile' : 'Desktop'}</div>
            </div>
            <div>
              <div className="text-gray-500">WebGL2</div>
              <div>{deviceInfo.supportsWebGL2 ? '✅ Supporté' : '❌ Non supporté'}</div>
            </div>
            <div>
              <div className="text-gray-500">Mode recommandé</div>
              <div className="capitalize">{deviceInfo.recommendedSettings.performanceMode}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Performance Test */}
      <Card className="p-6">
        <h3 className="text-xl font-medium mb-4">Test de Performance</h3>
        <PerformanceTest onResults={setResults} />
      </Card>

      {/* Overall Results */}
      {results.length > 0 && (
        <Card className="p-6">
          <h3 className="text-xl font-medium mb-4">Résumé Global</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {getOverallScore()}%
              </div>
              <div className="text-gray-500">Score Global</div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {results.filter(r => r.passed).length}/{results.length}
              </div>
              <div className="text-gray-500">Tests Réussis</div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {Math.max(...results.map(r => r.pointCount)).toLocaleString()}
              </div>
              <div className="text-gray-500">Max Points Testés</div>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Recommandation</h4>
            <p className="text-gray-700">{getRecommendation()}</p>
          </div>
        </Card>
      )}
    </div>
  );
}