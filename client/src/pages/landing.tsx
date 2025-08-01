import { useState } from "react";
import * as React from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Database, Zap, Eye, ArrowRight, Sparkles, Brain, Target, Mail, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { LoginCredentials, RegisterCredentials } from "@/types/dataset";

// Auth Modal Component
function AuthModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [loginForm, setLoginForm] = useState<LoginCredentials>({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState<RegisterCredentials>({ email: '', password: '', confirm_password: '', name: '' });
  const { login, register, isLoggingIn, isRegistering, loginError, registerError, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Close modal when authentication is successful and navigate to dashboard
  React.useEffect(() => {
    console.log('AuthModal - Auth state changed:', { isAuthenticated, isOpen });
    if (isAuthenticated && isOpen) {
      console.log('AuthModal - Closing modal and redirecting to dashboard...');
      // Close modal and redirect to dashboard immediately
      onClose();
      // Navigate to the dashboard (authenticated main app)
      setLocation('/dashboard');
    }
  }, [isAuthenticated, isOpen, onClose, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(loginForm);
      // Success handling is done by the useEffect above
    } catch (error) {
      // Error is handled by the useAuth hook
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(registerForm);
      // Success handling is done by the useEffect above
    } catch (error) {
      // Error is handled by the useAuth hook
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md mx-4"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="bg-gray-900/95 border-gray-700 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-white">
              <Sparkles className="w-6 h-6 text-cyan-400" />
              Bienvenue sur Data Mirage
            </CardTitle>
            <CardDescription className="text-gray-300">
              Connectez-vous ou créez un compte pour commencer
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-800">
                <TabsTrigger value="login" className="text-gray-300 data-[state=active]:text-white">
                  Connexion
                </TabsTrigger>
                <TabsTrigger value="register" className="text-gray-300 data-[state=active]:text-white">
                  Inscription
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="space-y-4 mt-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        type="email"
                        placeholder="Email"
                        value={loginForm.email}
                        onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                        className="pl-10 bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        type="password"
                        placeholder="Mot de passe"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        className="pl-10 bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                        required
                      />
                    </div>
                  </div>
                  
                  {loginError && (
                    <div className="text-red-400 text-sm text-center">
                      {loginError.message}
                    </div>
                  )}
                  
                  <Button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
                  >
                    {isLoggingIn ? "Connexion..." : "Se connecter"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register" className="space-y-4 mt-6">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Nom (optionnel)"
                        value={registerForm.name || ''}
                        onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                        className="pl-10 bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        type="email"
                        placeholder="Email"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                        className="pl-10 bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        type="password"
                        placeholder="Mot de passe"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                        className="pl-10 bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                        required
                      />
                    </div>
                    
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        type="password"
                        placeholder="Confirmer le mot de passe"
                        value={registerForm.confirm_password}
                        onChange={(e) => setRegisterForm({ ...registerForm, confirm_password: e.target.value })}
                        className="pl-10 bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                        required
                      />
                    </div>
                  </div>
                  
                  {registerError && (
                    <div className="text-red-400 text-sm text-center">
                      {registerError.message}
                    </div>
                  )}
                  
                  <Button
                    type="submit"
                    disabled={isRegistering}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  >
                    {isRegistering ? "Création..." : "Créer un compte"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export default function Landing() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect authenticated users to the dashboard
  React.useEffect(() => {
    if (isAuthenticated && !isLoading) {
      console.log('Landing - User is authenticated, redirecting to dashboard');
      setLocation('/dashboard');
    }
  }, [isAuthenticated, isLoading, setLocation]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-400 border-t-transparent"></div>
          <div className="text-cyan-400 text-lg font-medium">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(50)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-blue-400 rounded-full opacity-60"
            initial={{ 
              x: Math.random() * window.innerWidth, 
              y: Math.random() * window.innerHeight 
            }}
            animate={{ 
              y: [null, -20, 20],
              opacity: [0.6, 1, 0.6]
            }}
            transition={{ 
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {/* Navigation */}
      <motion.nav 
        className="relative z-10 p-6 flex justify-between items-center backdrop-blur-sm bg-black/20"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div 
          className="flex items-center space-x-2"
          whileHover={{ scale: 1.05 }}
        >
          <Sparkles className="w-8 h-8 text-cyan-400" />
          <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Data Mirage
          </span>
        </motion.div>
        
        <Button 
          onClick={() => setIsAuthModalOpen(true)}
          className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-semibold px-6 py-2 rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/25"
        >
          Se connecter
        </Button>
      </motion.nav>

      {/* Hero Section */}
      <div className="relative z-10 container mx-auto px-6 pt-20 pb-32">
        <div className="text-center max-w-4xl mx-auto">
          <motion.h1 
            className="text-6xl md:text-8xl font-bold mb-8 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Data Mirage
          </motion.h1>
          
          <motion.p 
            className="text-xl md:text-2xl mb-12 text-gray-300 leading-relaxed"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            Transformez vos données en <span className="text-cyan-400 font-semibold">expériences 3D immersives</span> 
            <br />avec l'intelligence artificielle
          </motion.p>

          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <Button 
              onClick={() => setIsAuthModalOpen(true)}
              className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-semibold px-8 py-4 rounded-lg text-lg transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/30 flex items-center gap-2"
            >
              Commencer l'aventure <ArrowRight className="w-5 h-5" />
            </Button>
            
            <Button 
              variant="outline" 
              className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-gray-900 px-8 py-4 rounded-lg text-lg transition-all duration-300"
            >
              Voir la démo
            </Button>
          </motion.div>
        </div>

        {/* Features Grid */}
        <motion.div 
          className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          {[
            {
              icon: Database,
              title: "Import Intelligent",
              description: "Chargez vos CSV et JSON en un clic. Notre IA analyse automatiquement vos données.",
              gradient: "from-blue-500 to-cyan-500"
            },
            {
              icon: Brain,
              title: "Machine Learning",
              description: "Clustering automatique, réduction dimensionnelle et détection d'anomalies.",
              gradient: "from-purple-500 to-pink-500"
            },
            {
              icon: Eye,
              title: "Visualisation 3D",
              description: "Explorez vos données dans un univers 3D interactif avec des connexions intelligentes.",
              gradient: "from-cyan-500 to-blue-500"
            }
          ].map((feature, index) => (
            <motion.div
              key={index}
              className="relative group"
              whileHover={{ scale: 1.05, y: -5 }}
              transition={{ duration: 0.3 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 rounded-xl backdrop-blur-sm border border-white/20 transition-all duration-300 group-hover:border-white/40"></div>
              <div className="relative p-8 text-center">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-white">{feature.title}</h3>
                <p className="text-gray-300 leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Statistics */}
        <motion.div 
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
        >
          {[
            { number: "1000+", label: "Datasets analysés" },
            { number: "10M+", label: "Points visualisés" },
            { number: "99%", label: "Précision ML" },
            { number: "3D", label: "Expérience immersive" }
          ].map((stat, index) => (
            <motion.div
              key={index}
              className="text-center"
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-3xl md:text-4xl font-bold text-cyan-400 mb-2">{stat.number}</div>
              <div className="text-gray-300 text-sm">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Bottom glow */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-cyan-500/20 to-transparent"></div>
      
      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}