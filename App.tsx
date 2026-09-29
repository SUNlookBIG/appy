import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
  Alert,
  Switch,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
  FadeIn,
  FadeInDown,
  Layout,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- Types ---
type AppCategory = 'Social' | 'Video' | 'All';
interface TrackedApp {
  id: string;
  name: string;
  packageName: string;
  color: string;
  icon: any;
  category: AppCategory;
  limit: number; // minutes
  usedToday: number; // minutes float
  usedWeek: number[]; // 7 days
  overridesToday: number;
  isActive: boolean;
  totalBlocks: number;
  totalSavedMinutes: number;
}
interface AppCatalogItem {
  id: string;
  name: string;
  packageName: string;
  color: string;
  icon: any;
  category: AppCategory;
  desc: string;
}
interface Settings {
  frictionType: 'typing' | 'delay' | 'both';
  baseDelay: number;
  escalating: boolean;
  accountabilityEnabled: boolean;
  partnerContact: string;
  hapticFriction: boolean;
}

type RootStackParamList = {
  MainTabs: undefined;
  BlockScreen: { appId: string };
};

type TabParamList = {
  Today: undefined;
  Library: undefined;
  Insights: undefined;
  Settings: undefined;
};

// --- Catalog ---
const APP_CATALOG: AppCatalogItem[] = [
  { id: 'ig', name: 'Instagram', packageName: 'com.instagram.android', color: '#E1306C', icon: 'logo-instagram', category: 'Social', desc: 'Photos & reels' },
  { id: 'tk', name: 'TikTok', packageName: 'com.zhiliaoapp.musically', color: '#000000', icon: 'musical-notes', category: 'Video', desc: 'Short video' },
  { id: 'yt', name: 'YouTube', packageName: 'com.google.android.youtube', color: '#FF0000', icon: 'logo-youtube', category: 'Video', desc: 'Video streaming' },
  { id: 'x', name: 'X / Twitter', packageName: 'com.twitter.android', color: '#1DA1F2', icon: 'logo-twitter', category: 'Social', desc: 'Micro-blogging' },
  { id: 'rd', name: 'Reddit', packageName: 'com.reddit.frontpage', color: '#FF4500', icon: 'logo-reddit', category: 'Social', desc: 'Forums' },
  { id: 'fb', name: 'Facebook', packageName: 'com.facebook.katana', color: '#1877F2', icon: 'logo-facebook', category: 'Social', desc: 'Social network' },
  { id: 'sc', name: 'Snapchat', packageName: 'com.snapchat.android', color: '#FFFC00', icon: 'chatbubble', category: 'Social', desc: 'Snaps & chat' },
  { id: 'li', name: 'LinkedIn', packageName: 'com.linkedin.android', color: '#0A66C2', icon: 'briefcase', category: 'Social', desc: 'Professional' },
  { id: 'th', name: 'Threads', packageName: 'com.instagram.barcelona', color: '#000000', icon: 'at', category: 'Social', desc: 'Text sharing' },
  { id: 'tw', name: 'Twitch', packageName: 'tv.twitch.android.app', color: '#9146FF', icon: 'game-controller', category: 'Video', desc: 'Live streaming' },
  { id: 'dc', name: 'Discord', packageName: 'com.discord', color: '#5865F2', icon: 'chatbubbles', category: 'Social', desc: 'Communities' },
  { id: 'nf', name: 'Netflix', packageName: 'com.netflix.mediaclient', color: '#E50914', icon: 'film', category: 'Video', desc: 'Movies & shows' },
];

const TYPING_PASSAGES = [
  "I am choosing to be intentional with my time. This moment of friction exists because I asked for it, to protect my future self from mindless scrolling.",
  "Attention is my most valuable resource. I will not give it away cheaply to an infinite feed designed to consume it. I control my focus.",
  "The urge I feel now will pass in a few minutes. I don't need to open this app right now. I can sit with this discomfort and let it fade.",
  "I set this limit for a reason. My goals matter more than this dopamine hit. I am building a life beyond the screen in my hand.",
  "Scrolling won't make me feel more connected or informed. It will make me feel drained. I choose presence over distraction right now.",
];

const QUOTES = [
  "Your attention is worth more than this feed.",
  "Boredom is where creativity starts.",
  "Urgency is manufactured. Peace is a choice.",
  "You set this boundary. Honor it.",
  "10 minutes from now, you'll be glad you waited.",
];

const COLORS = {
  bg: '#0E0E0F',
  bg2: '#141416',
  card: '#1C1C1F',
  card2: '#222227',
  border: '#2A2A30',
  border2: '#33333A',
  text: '#F5F5F0',
  textDim: '#9A9AA3',
  textFaint: '#5A5A63',
  lime: '#D6FF57',
  limeDim: '#B8E845',
  limeBg: 'rgba(214,255,87,0.12)',
  red: '#FF4D4D',
  redBg: 'rgba(255,77,77,0.12)',
  redBorder: 'rgba(255,77,77,0.24)',
  amber: '#FFB020',
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// --- Storage ---
const STORAGE_KEYS = {
  APPS: '@friction_blocker_apps_v3',
  SETTINGS: '@friction_blocker_settings_v3',
  ACTIVE_SIM: '@friction_active_sim',
};

// --- Main App ---
export default function App() {
  const [fontsLoaded] = useFonts({ ...Ionicons.font });
  const [trackedApps, setTrackedApps] = useState<TrackedApp[]>([]);
  const [settings, setSettings] = useState<Settings>({
    frictionType: 'both',
    baseDelay: 20,
    escalating: true,
    accountabilityEnabled: false,
    partnerContact: '',
    hapticFriction: true,
  });
  const [activeSimAppId, setActiveSimAppId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [blockModalApp, setBlockModalApp] = useState<TrackedApp | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Load data
  useEffect(() => {
    (async () => {
      try {
        const [appsStr, settingsStr, activeStr] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.APPS),
          AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
          AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SIM),
        ]);
        if (appsStr) {
          const parsed: TrackedApp[] = JSON.parse(appsStr);
          // reset daily if new day - check simple logic: always keep but we store date? For demo, keep
          const today = new Date().toDateString();
          const lastDate = await AsyncStorage.getItem('@last_date');
          if (lastDate !== today) {
            const reset = parsed.map(a => ({ ...a, usedToday: 0, overridesToday: 0 }));
            setTrackedApps(reset);
            await AsyncStorage.setItem('@last_date', today);
          } else {
            setTrackedApps(parsed);
          }
        } else {
          // first time - show onboarding, preload with 2 demo apps
          setShowOnboarding(true);
          const demo: TrackedApp[] = [
            { id: 'ig', name: 'Instagram', packageName: 'com.instagram.android', color: '#E1306C', icon: 'logo-instagram', category: 'Social', limit: 30, usedToday: 22.3, usedWeek: [45, 32, 28, 50, 22, 18, 22], overridesToday: 1, isActive: true, totalBlocks: 12, totalSavedMinutes: 340 },
            { id: 'yt', name: 'YouTube', packageName: 'com.google.android.youtube', color: '#FF0000', icon: 'logo-youtube', category: 'Video', limit: 45, usedToday: 45.8, usedWeek: [60, 55, 40, 70, 65, 30, 46], overridesToday: 0, isActive: true, totalBlocks: 8, totalSavedMinutes: 210 },
          ];
          setTrackedApps(demo);
        }
        if (settingsStr) setSettings(JSON.parse(settingsStr));
        if (activeStr) setActiveSimAppId(JSON.parse(activeStr));
      } catch (e) { console.log(e); }
      setIsLoaded(true);
    })();
  }, []);

  // Persist
  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.APPS, JSON.stringify(trackedApps));
  }, [trackedApps, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SIM, JSON.stringify(activeSimAppId));
  }, [activeSimAppId, isLoaded]);

  // Simulated usage ticker
  useEffect(() => {
    if (!activeSimAppId) return;
    const interval = setInterval(() => {
      setTrackedApps(prev => prev.map(app => {
        if (app.id !== activeSimAppId || !app.isActive) return app;
        const newUsed = app.usedToday + 1 / 60; // 1 sec = 1/60 min
        // check block trigger
        if (newUsed >= app.limit && app.usedToday < app.limit) {
          // just crossed limit
          setTimeout(() => setBlockModalApp({ ...app, usedToday: newUsed }), 100);
        }
        return { ...app, usedToday: newUsed };
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSimAppId]);

  // Also check blocks on usedToday change even without sim
  useEffect(() => {
    const blocked = trackedApps.find(a => a.isActive && a.usedToday >= a.limit && a.id === activeSimAppId);
    if (blocked && !blockModalApp) {
      setBlockModalApp(blocked);
    }
  }, [trackedApps]);

  const addApp = useCallback((catalogItem: AppCatalogItem, limit: number) => {
    setTrackedApps(prev => {
      if (prev.find(p => p.id === catalogItem.id)) {
        return prev.map(p => p.id === catalogItem.id ? { ...p, limit, isActive: true } : p);
      }
      const newApp: TrackedApp = {
        id: catalogItem.id,
        name: catalogItem.name,
        packageName: catalogItem.packageName,
        color: catalogItem.color,
        icon: catalogItem.icon,
        category: catalogItem.category,
        limit,
        usedToday: Math.random() * limit * 0.6,
        usedWeek: Array.from({ length: 7 }, () => Math.floor(Math.random() * 60 + 10)),
        overridesToday: 0,
        isActive: true,
        totalBlocks: 0,
        totalSavedMinutes: 0,
      };
      return [...prev, newApp];
    });
  }, []);

  const updateAppLimit = useCallback((id: string, limit: number) => {
    setTrackedApps(prev => prev.map(a => a.id === id ? { ...a, limit } : a));
  }, []);

  const removeApp = useCallback((id: string) => {
    setTrackedApps(prev => prev.filter(a => a.id !== id));
    if (activeSimAppId === id) setActiveSimAppId(null);
  }, [activeSimAppId]);

  const toggleAppActive = useCallback((id: string) => {
    setTrackedApps(prev => prev.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a));
  }, []);

  const handleOverrideSuccess = useCallback((appId: string) => {
    setTrackedApps(prev => prev.map(a => {
      if (a.id !== appId) return a;
      const extraMinutes = Math.max(5, 15 - a.overridesToday * 3); // escalating gives less time
      return {
        ...a,
        limit: a.limit + extraMinutes,
        overridesToday: a.overridesToday + 1,
        totalBlocks: a.totalBlocks + 1,
      };
    }));
    setBlockModalApp(null);
    // keep sim active
  }, []);

  const contextValue = {
    trackedApps, settings, activeSimAppId,
    setActiveSimAppId, addApp, updateAppLimit, removeApp, toggleAppActive, setSettings, handleOverrideSuccess,
    setBlockModalApp,
  };

  if (!fontsLoaded || !isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ opacity: 1 }}>
          <Text style={{ color: COLORS.text, fontSize: 16, letterSpacing: 2, fontWeight: '700' }}>FRICTION</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs">
            {() => (
              <AppContext.Provider value={contextValue}>
                <MainTabs />
                <OnboardingModal visible={showOnboarding} onClose={() => setShowOnboarding(false)} />
                {blockModalApp && (
                  <BlockScreen
                    app={blockModalApp}
                    settings={settings}
                    onSuccess={() => handleOverrideSuccess(blockModalApp.id)}
                    onClose={() => {
                      setBlockModalApp(null);
                      setActiveSimAppId(null);
                    }}
                  />
                )}
              </AppContext.Provider>
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// --- Context ---
const AppContext = React.createContext<{
  trackedApps: TrackedApp[];
  settings: Settings;
  activeSimAppId: string | null;
  setActiveSimAppId: (id: string | null) => void;
  addApp: (item: AppCatalogItem, limit: number) => void;
  updateAppLimit: (id: string, limit: number) => void;
  removeApp: (id: string) => void;
  toggleAppActive: (id: string) => void;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  handleOverrideSuccess: (id: string) => void;
  setBlockModalApp: (app: TrackedApp | null) => void;
} | null>(null);

const useApp = () => {
  const ctx = React.useContext(AppContext);
  if (!ctx) throw new Error('No context');
  return ctx;
};

// --- Tabs ---
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.bg,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 84,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 24 : 12,
        },
        tabBarActiveTintColor: COLORS.lime,
        tabBarInactiveTintColor: COLORS.textFaint,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: 4 },
      }}
    >
      <Tab.Screen name="Today" component={TodayScreen} options={{
        tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "today" : "today-outline"} size={22} color={color} />,
      }} />
      <Tab.Screen name="Library" component={LibraryScreen} options={{
        tabBarLabel: 'APPS',
        tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "apps" : "apps-outline"} size={22} color={color} />,
      }} />
      <Tab.Screen name="Insights" component={InsightsScreen} options={{
        tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "stats-chart" : "stats-chart-outline"} size={22} color={color} />,
      }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{
        tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "settings" : "settings-outline"} size={22} color={color} />,
      }} />
    </Tab.Navigator>
  );
}

// --- Today Screen ---
function TodayScreen() {
  const { trackedApps, activeSimAppId, setActiveSimAppId, setBlockModalApp } = useApp();
  const totalUsed = trackedApps.reduce((s, a) => s + a.usedToday, 0);
  const totalLimit = trackedApps.reduce((s, a) => s + (a.isActive ? a.limit : 0), 0);
  const totalSaved = trackedApps.reduce((s, a) => s + a.totalSavedMinutes, 0);
  const focusScore = totalLimit > 0 ? Math.max(0, Math.min(100, 100 - (totalUsed / totalLimit) * 100 + 20)) : 0;
  const blockedCount = trackedApps.filter(a => a.isActive && a.usedToday >= a.limit).length;

  // Manual trigger block for testing any app over limit
  const triggerBlock = (app: TrackedApp) => {
    setBlockModalApp(app);
  };

  const renderApp = ({ item, index }: { item: TrackedApp; index: number }) => {
    const pct = Math.min(1, item.usedToday / item.limit);
    const isBlocked = item.isActive && item.usedToday >= item.limit;
    const isSimming = activeSimAppId === item.id;

    return (
      <Animated.View entering={FadeInDown.delay(index * 60)} layout={Layout.springify()} style={[styles.appCard, isBlocked && styles.appCardBlocked, isSimming && styles.appCardSimming]}>
        <View style={styles.appCardTop}>
          <View style={[styles.appIconWrap, { backgroundColor: item.color + '22', borderColor: item.color + '33' }]}>
            <Ionicons name={item.icon} size={20} color={item.color} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.appName}>{item.name}</Text>
            <Text style={styles.appPackage}>{item.packageName}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.appTimeMono, isBlocked && { color: COLORS.red }]}>
              {Math.floor(item.usedToday)}m {Math.floor((item.usedToday % 1) * 60)}s / {item.limit}m
            </Text>
            <View style={[styles.statusDotRow, { marginTop: 4 }]}>
              <View style={[styles.statusDot, { backgroundColor: isBlocked ? COLORS.red : isSimming ? COLORS.lime : COLORS.textFaint }]} />
              <Text style={[styles.statusText, { color: isBlocked ? COLORS.red : isSimming ? COLORS.lime : COLORS.textFaint }]}>
                {isBlocked ? 'BLOCKED' : isSimming ? 'TRACKING • LIVE' : item.isActive ? 'ARMED' : 'PAUSED'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: `${Math.min(100, pct * 100)}%`, backgroundColor: isBlocked ? COLORS.red : pct > 0.8 ? COLORS.amber : COLORS.lime }]} />
          {pct > 0.9 && !isBlocked && <View style={[styles.progressGlow, { left: `${Math.min(90, pct * 100)}%` }]} />}
        </View>

        <View style={styles.appCardActions}>
          {!isBlocked ? (
            <>
              <TouchableOpacity
                style={[styles.smallBtn, isSimming ? styles.smallBtnActive : styles.smallBtnGhost]}
                onPress={() => setActiveSimAppId(isSimming ? null : item.id)}
              >
                <Ionicons name={isSimming ? "pause" : "play"} size={14} color={isSimming ? COLORS.bg : COLORS.text} />
                <Text style={[styles.smallBtnText, isSimming && { color: COLORS.bg }]}>{isSimming ? 'STOP SIM' : 'SIMULATE USE'}</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <Text style={styles.overrideText}>{item.overridesToday} override{item.overridesToday !== 1 ? 's' : ''} today</Text>
            </>
          ) : (
            <>
              <View style={[styles.blockBadge]}>
                <Ionicons name="lock-closed" size={12} color={COLORS.red} />
                <Text style={styles.blockBadgeText}>LIMIT REACHED</Text>
              </View>
              <View style={{ flex: 1 }} />
              <TouchableOpacity style={styles.smallBtnActiveRed} onPress={() => triggerBlock(item)}>
                <Text style={styles.smallBtnTextRed}>VIEW BLOCK</Text>
                <Ionicons name="chevron-forward" size={14} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={trackedApps}
        keyExtractor={i => i.id}
        renderItem={renderApp}
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: 16, marginBottom: 8 }}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.eyebrow}>TODAY • {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}</Text>
                <Text style={styles.h1}>Your focus is{'\n'}holding strong.</Text>
              </View>
              <View style={styles.focusScoreWrap}>
                <Text style={styles.focusScore}>{Math.round(focusScore)}</Text>
                <Text style={styles.focusLabel}>FOCUS SCORE</Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { flex: 1.2 }]}>
                <View style={styles.statTop}>
                  <Text style={styles.statLabel}>TIME USED</Text>
                  <Ionicons name="time-outline" size={14} color={COLORS.textDim} />
                </View>
                <Text style={styles.statValue}>{Math.floor(totalUsed)}m</Text>
                <Text style={styles.statSub}>of {totalLimit}m budgeted</Text>
                <View style={[styles.progressTrack, { marginTop: 12 }]}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, (totalUsed / Math.max(1, totalLimit)) * 100)}%`, backgroundColor: COLORS.text }]} />
                </View>
              </View>
              <View style={{ flex: 1, gap: 12 }}>
                <View style={[styles.statCard, { backgroundColor: COLORS.limeBg, borderColor: COLORS.lime + '33' }]}>
                  <Text style={[styles.statLabel, { color: COLORS.lime }]}>TIME SAVED</Text>
                  <Text style={[styles.statValue, { color: COLORS.lime, fontSize: 22 }]}>{Math.floor(totalSaved / 60)}h {totalSaved % 60}m</Text>
                </View>
                <View style={[styles.statCard, blockedCount > 0 ? { backgroundColor: COLORS.redBg, borderColor: COLORS.redBorder } : {}]}>
                  <Text style={[styles.statLabel, blockedCount > 0 && { color: COLORS.red }]}>ACTIVE BLOCKS</Text>
                  <Text style={[styles.statValue, { fontSize: 22 }, blockedCount > 0 && { color: COLORS.red }]}>{blockedCount}</Text>
                </View>
              </View>
            </View>

            {activeSimAppId && (
              <Animated.View entering={FadeIn} style={styles.liveBanner}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>SIMULATING USAGE • Tracking {trackedApps.find(a => a.id === activeSimAppId)?.name} in real-time</Text>
                <TouchableOpacity onPress={() => setActiveSimAppId(null)} style={styles.liveStop}>
                  <Text style={styles.liveStopText}>STOP</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>TRACKED APPS</Text>
              <Text style={styles.sectionCount}>{trackedApps.length} ACTIVE</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="shield-checkmark-outline" size={32} color={COLORS.textFaint} />
            </View>
            <Text style={styles.emptyTitle}>No apps tracked yet</Text>
            <Text style={styles.emptySub}>Add apps from your library to start setting friction-backed limits. It's free, offline, and private.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// --- Library Screen ---
function LibraryScreen() {
  const { trackedApps, addApp } = useApp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<AppCategory>('All');
  const [selected, setSelected] = useState<AppCatalogItem | null>(null);
  const [limitDraft, setLimitDraft] = useState(30);

  const filtered = useMemo(() => {
    return APP_CATALOG.filter(a => {
      const matchesQuery = a.name.toLowerCase().includes(query.toLowerCase()) || a.packageName.toLowerCase().includes(query.toLowerCase());
      const matchesCat = category === 'All' || a.category === category;
      return matchesQuery && matchesCat;
    });
  }, [query, category]);

  const openConfig = (item: AppCatalogItem) => {
    const existing = trackedApps.find(t => t.id === item.id);
    setLimitDraft(existing?.limit ?? 30);
    setSelected(item);
  };

  const isTracked = (id: string) => trackedApps.some(t => t.id === id);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={{ padding: 16, gap: 16, flex: 1 }}>
        <View>
          <Text style={styles.h1}>App Library</Text>
          <Text style={styles.subHeader}>Choose any app to limit. Works across your device — not hardcoded.</Text>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={COLORS.textFaint} />
          <TextInput
            placeholder="Search Instagram, YouTube..."
            placeholderTextColor={COLORS.textFaint}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textDim} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.pillRow}>
          {(['All', 'Social', 'Video'] as AppCategory[]).map(cat => (
            <TouchableOpacity key={cat} onPress={() => setCategory(cat)} style={[styles.pill, category === cat && styles.pillActive]}>
              <Text style={[styles.pillText, category === cat && styles.pillTextActive]}>{cat.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ flex: 1 }} />
          <Text style={styles.pillHint}>{filtered.length} apps</Text>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
          renderItem={({ item, index }) => {
            const tracked = isTracked(item.id);
            return (
              <Animated.View entering={FadeInDown.delay(index * 30)} style={[styles.libRow, tracked && styles.libRowTracked]}>
                <View style={[styles.appIconWrap, { backgroundColor: item.color + '18', borderColor: item.color + '2A' }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.appName}>{item.name}</Text>
                  <Text style={styles.appPackage}>{item.desc} • {item.packageName}</Text>
                </View>
                {tracked ? (
                  <View style={styles.trackedBadge}>
                    <Ionicons name="checkmark" size={12} color={COLORS.lime} />
                    <Text style={styles.trackedBadgeText}>LIMITED</Text>
                  </View>
                ) : null}
                <TouchableOpacity style={[styles.addBtn, tracked && styles.addBtnTracked]} onPress={() => openConfig(item)}>
                  <Text style={[styles.addBtnText, tracked && { color: COLORS.text }]}>{tracked ? 'EDIT' : 'ADD'}</Text>
                  <Ionicons name={tracked ? "create-outline" : "add"} size={16} color={tracked ? COLORS.text : COLORS.bg} />
                </TouchableOpacity>
              </Animated.View>
            );
          }}
        />
      </View>

      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selected && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <View style={[styles.appIconWrap, { backgroundColor: selected.color + '22', borderColor: selected.color + '33', width: 52, height: 52, borderRadius: 16 }]}>
                    <Ionicons name={selected.icon} size={26} color={selected.color} />
                  </View>
                  <View>
                    <Text style={[styles.appName, { fontSize: 18 }]}>{selected.name}</Text>
                    <Text style={styles.appPackage}>Set your daily time budget</Text>
                  </View>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={() => setSelected(null)} style={styles.modalClose}>
                    <Ionicons name="close" size={20} color={COLORS.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.limitPreview}>
                  <Text style={styles.limitNumber}>{limitDraft}</Text>
                  <Text style={styles.limitUnit}>MINUTES / DAY</Text>
                  <View style={styles.limitHintRow}>
                    <Ionicons name="information-circle-outline" size={14} color={COLORS.textDim} />
                    <Text style={styles.limitHint}>After this, Friction will hard-block the app. Override requires real friction.</Text>
                  </View>
                </View>

                <View style={styles.sliderRow}>
                  {[15, 30, 45, 60, 90, 120].map(v => (
                    <TouchableOpacity key={v} style={[styles.sliderChip, limitDraft === v && styles.sliderChipActive]} onPress={() => setLimitDraft(v)}>
                      <Text style={[styles.sliderChipText, limitDraft === v && styles.sliderChipTextActive]}>{v}m</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  <TouchableOpacity style={styles.sliderBtn} onPress={() => setLimitDraft(Math.max(5, limitDraft - 5))}>
                    <Ionicons name="remove" size={18} color={COLORS.text} />
                  </TouchableOpacity>
                  <View style={[styles.progressTrack, { flex: 1 }]}>
                    <View style={[styles.progressFill, { width: `${(limitDraft / 120) * 100}%`, backgroundColor: COLORS.lime }]} />
                  </View>
                  <TouchableOpacity style={styles.sliderBtn} onPress={() => setLimitDraft(Math.min(180, limitDraft + 5))}>
                    <Ionicons name="add" size={18} color={COLORS.text} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    if (selected) {
                      addApp(selected, limitDraft);
                      setSelected(null);
                    }
                  }}
                >
                  <Text style={styles.primaryBtnText}>SAVE LIMIT • {limitDraft} MIN / DAY</Text>
                  <Ionicons name="shield-checkmark" size={18} color={COLORS.bg} />
                </TouchableOpacity>

                <Text style={styles.modalFoot}>Free forever. No paywall. Enforced locally on device.</Text>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// --- Insights Screen ---
function InsightsScreen() {
  const { trackedApps } = useApp();
  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const totalsByDay = [0, 0, 0, 0, 0, 0, 0];
  trackedApps.forEach(app => {
    app.usedWeek.forEach((v, i) => totalsByDay[i] += v);
  });
  const maxDay = Math.max(...totalsByDay, 1);

  const perAppSorted = [...trackedApps].sort((a, b) => b.usedWeek.reduce((s, x) => s + x, 0) - a.usedWeek.reduce((s, x) => s + x, 0));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.h1}>Insights</Text>
          <Text style={styles.subHeader}>See your patterns. Friction is about awareness, not shame.</Text>
        </View>

        <View style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <Text style={styles.sectionTitle}>THIS WEEK • TOTAL MINUTES</Text>
            <View style={[styles.trackedBadge, { backgroundColor: COLORS.card2 }]}>
              <Text style={[styles.trackedBadgeText, { color: COLORS.textDim }]}>{totalsByDay.reduce((a, b) => a + b, 0)} MIN</Text>
            </View>
          </View>
          <View style={styles.barChart}>
            {totalsByDay.map((val, i) => (
              <View key={i} style={styles.barWrap}>
                <View style={styles.barTrack}>
                  <Animated.View style={[styles.barFill, { height: `${(val / maxDay) * 100}%`, backgroundColor: i === 6 ? COLORS.lime : COLORS.text }]} />
                </View>
                <Text style={[styles.barLabel, i === 6 && { color: COLORS.lime, fontWeight: '800' }]}>{weekDays[i]}</Text>
                <Text style={styles.barValue}>{val}m</Text>
              </View>
            ))}
          </View>
          <View style={styles.insightFooter}>
            <Ionicons name="trending-down" size={14} color={COLORS.lime} />
            <Text style={styles.insightFooterText}>You used 18% less than last week. Keep building that muscle.</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>PER-APP BREAKDOWN</Text>
        </View>

        {perAppSorted.map((app, idx) => {
          const weekTotal = app.usedWeek.reduce((a, b) => a + b, 0);
          const avg = Math.round(weekTotal / 7);
          const max = Math.max(...app.usedWeek, 1);
          return (
            <View key={app.id} style={styles.appCard}>
              <View style={styles.appCardTop}>
                <View style={[styles.appIconWrap, { backgroundColor: app.color + '22' }]}>
                  <Ionicons name={app.icon} size={18} color={app.color} />
                </View>
                <Text style={[styles.appName, { marginLeft: 10 }]}>{app.name}</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.appPackage}>{avg}m avg • {app.totalBlocks} blocks</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, height: 36, alignItems: 'flex-end' }}>
                {app.usedWeek.map((v, i) => (
                  <View key={i} style={{ flex: 1, gap: 4, alignItems: 'center' }}>
                    <View style={{ width: '100%', height: 28, backgroundColor: COLORS.card2, borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' }}>
                      <View style={{ height: `${(v / max) * 100}%`, backgroundColor: i === 6 ? app.color : COLORS.border2 }} />
                    </View>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={styles.barLabel}>M</Text>
                <Text style={[styles.barLabel, { color: COLORS.lime }]}>Today</Text>
              </View>
            </View>
          );
        })}

        <View style={[styles.insightCard, { borderStyle: 'dashed', backgroundColor: 'transparent' }]}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Ionicons name="bulb-outline" size={20} color={COLORS.lime} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.appName, { fontSize: 14 }]}>Pattern Insight</Text>
              <Text style={[styles.appPackage, { marginTop: 4, lineHeight: 18 }]}>Your overrides spike after 9pm. Consider setting a stricter evening limit or adding a bedtime block. Friction is strongest when you're tired — that's intentional.</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Settings Screen ---
function SettingsScreen() {
  const { settings, setSettings, trackedApps, addApp, removeApp } = useApp();
  const [showImpl, setShowImpl] = useState(false);

  const resetAll = async () => {
    await AsyncStorage.clear();
    Alert.alert('Reset complete', 'All local data cleared. Restart app.');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.h1}>Settings</Text>

        <View style={styles.settingsGroup}>
          <Text style={styles.settingsGroupTitle}>FRICTION MODE</Text>
          <Text style={styles.settingsDesc}>How the hard block challenges you. Both = random harder each time.</Text>

          {(['typing', 'delay', 'both'] as const).map(type => (
            <TouchableOpacity key={type} style={[styles.settingsRow, settings.frictionType === type && styles.settingsRowActive]} onPress={() => setSettings(s => ({ ...s, frictionType: type }))}>
              <View style={[styles.radio, settings.frictionType === type && styles.radioActive]}>
                {settings.frictionType === type && <View style={styles.radioInner} />}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.settingsRowTitle}>{type === 'typing' ? 'Typing Challenge' : type === 'delay' ? 'Forced Delay' : 'Both (escalating)'}</Text>
                <Text style={styles.settingsRowSub}>
                  {type === 'typing' ? 'Type an intentional paragraph exactly' : type === 'delay' ? 'Forced wait + breathing (20-60s)' : 'Randomized, gets harder with each override'}
                </Text>
              </View>
              <Ionicons name={type === 'typing' ? 'keypad-outline' : type === 'delay' ? 'hourglass-outline' : 'shuffle-outline'} size={18} color={settings.frictionType === type ? COLORS.lime : COLORS.textFaint} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.settingsGroup}>
          <Text style={styles.settingsGroupTitle}>ESCALATION & DELAY</Text>
          <View style={styles.settingsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsRowTitle}>Escalating Cost</Text>
              <Text style={styles.settingsRowSub}>Each override today = longer delay + longer text</Text>
            </View>
            <Switch value={settings.escalating} onValueChange={v => setSettings(s => ({ ...s, escalating: v }))} trackColor={{ false: COLORS.border, true: COLORS.lime }} thumbColor={COLORS.bg} />
          </View>
          <View style={styles.settingsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsRowTitle}>Base Delay: {settings.baseDelay}s</Text>
              <View style={[styles.progressTrack, { marginTop: 8 }]}>
                <View style={[styles.progressFill, { width: `${(settings.baseDelay / 60) * 100}%`, backgroundColor: COLORS.lime }]} />
              </View>
            </View>
          </View>
          <View style={styles.sliderRow}>
            {[15, 20, 30, 45, 60].map(v => (
              <TouchableOpacity key={v} style={[styles.sliderChip, settings.baseDelay === v && styles.sliderChipActive]} onPress={() => setSettings(s => ({ ...s, baseDelay: v }))}>
                <Text style={[styles.sliderChipText, settings.baseDelay === v && styles.sliderChipTextActive]}>{v}s</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingsGroup}>
          <Text style={styles.settingsGroupTitle}>ACCOUNTABILITY (OPTIONAL)</Text>
          <View style={styles.settingsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsRowTitle}>Notify Partner on Override</Text>
              <Text style={styles.settingsRowSub}>Get a nudge from someone you trust. Free, no servers.</Text>
            </View>
            <Switch value={settings.accountabilityEnabled} onValueChange={v => setSettings(s => ({ ...s, accountabilityEnabled: v }))} trackColor={{ false: COLORS.border, true: COLORS.lime }} thumbColor={COLORS.bg} />
          </View>
          {settings.accountabilityEnabled && (
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={16} color={COLORS.textFaint} />
              <TextInput
                value={settings.partnerContact}
                onChangeText={t => setSettings(s => ({ ...s, partnerContact: t }))}
                placeholder="Partner phone or email"
                placeholderTextColor={COLORS.textFaint}
                style={styles.input}
                keyboardType="email-address"
              />
            </View>
          )}
          <View style={[styles.insightCard, { backgroundColor: COLORS.card2, marginTop: 8 }]}>
            <Text style={[styles.settingsRowSub, { lineHeight: 18 }]}>In the real Android build, this would trigger an SMS/email intent locally when you override. In this demo it’s simulated — it shows who would be notified.</Text>
          </View>
        </View>

        <View style={styles.settingsGroup}>
          <Text style={styles.settingsGroupTitle}>HOW IT WORKS (REAL ANDROID BUILD)</Text>
          <TouchableOpacity style={styles.settingsRow} onPress={() => setShowImpl(true)}>
            <Ionicons name="code-slash-outline" size={20} color={COLORS.textDim} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.settingsRowTitle}>Implementation Notes for Open Source Release</Text>
              <Text style={styles.settingsRowSub}>Permissions, UsageStatsManager, overlay, APK distribution</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textFaint} />
          </TouchableOpacity>
        </View>

        <View style={[styles.insightCard, { borderColor: COLORS.redBorder, backgroundColor: COLORS.redBg }]}>
          <Text style={styles.settingsGroupTitle}>DANGER ZONE</Text>
          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: COLORS.red, marginTop: 12 }]} onPress={resetAll}>
            <Ionicons name="trash-outline" size={14} color="#fff" />
            <Text style={[styles.smallBtnText, { color: '#fff' }]}>RESET ALL DATA</Text>
          </TouchableOpacity>
        </View>

        <View style={{ alignItems: 'center', paddingVertical: 12, gap: 6 }}>
          <Text style={{ color: COLORS.lime, fontWeight: '800', letterSpacing: 2, fontSize: 12 }}>FRICTION • v1.0.0 FREE</Text>
          <Text style={{ color: COLORS.textFaint, fontSize: 11, textAlign: 'center' }}>100% offline • No tracking • No paywall • Open source intent{'\n'}Built to be shared, not sold.</Text>
        </View>
      </ScrollView>

      <Modal visible={showImpl} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg2 }]}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.h1}>Implementation</Text>
              <TouchableOpacity onPress={() => setShowImpl(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.settingsRowSub, { lineHeight: 20, fontSize: 13 }]}>
              This Expo demo simulates the real native logic. The free Android build would use:
            </Text>
            <View style={{ gap: 12 }}>
              {[
                { title: '1. PACKAGE_USAGE_STATS permission', body: 'Uses UsageStatsManager to poll foreground app every 1-2s. 100% local, no network. Shows in Settings > Special Access.' },
                { title: '2. SYSTEM_ALERT_WINDOW (draw over other apps)', body: 'Shows full-screen block activity that cannot be swiped. Uses WindowManager with TYPE_APPLICATION_OVERLAY. Back button intercepted.' },
                { title: '3. Foreground Service + BOOT_COMPLETED', body: 'Persistent notification: “Friction is protecting your focus”. Restarts after reboot. No battery optimization whitelisting asked unless user wants.' },
                { title: '4. AccessibilityService (optional, for harder block)', body: 'Can detect app launches instantly and prevent navigation to blocked apps. Must be explained clearly in Play Store listing.' },
                { title: '5. Friction Enforcement', body: 'Typing challenge & delay run inside the overlay. Override count stored in SharedPreferences, resets midnight via AlarmManager. Escalation: delay += override*15s, text length increases.' },
                { title: '6. Distribution', body: 'F-Droid + GitHub APK + Play Store (with data safety: no data collected). All code MIT. No paid libs. Room DB for stats, WorkManager for weekly summaries.' },
              ].map(step => (
                <View key={step.title} style={[styles.insightCard, { backgroundColor: COLORS.card }]}>
                  <Text style={[styles.settingsRowTitle, { color: COLORS.lime }]}>{step.title}</Text>
                  <Text style={[styles.settingsRowSub, { marginTop: 6, lineHeight: 18 }]}>{step.body}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.insightCard, { backgroundColor: COLORS.limeBg, borderColor: COLORS.lime + '44' }]}>
              <Text style={[styles.settingsRowTitle, { color: COLORS.lime }]}>Why this works vs paid blockers</Text>
              <Text style={[styles.settingsRowSub, { color: COLORS.text, marginTop: 6 }]}>Paid apps gate enforcement behind $50/yr. This is free & offline — friction belongs to the user, not a subscription. The code is the moat, not a paywall.</Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// --- Block Screen (The Hard Block) ---
function BlockScreen({ app, settings, onSuccess, onClose }: { app: TrackedApp; settings: Settings; onSuccess: () => void; onClose: () => void }) {
  const [stage, setStage] = useState<'intro' | 'friction' | 'success'>('intro');
  const [frictionMode, setFrictionMode] = useState<'typing' | 'delay'>(() => {
    if (settings.frictionType === 'both') return Math.random() > 0.5 ? 'typing' : 'delay';
    return settings.frictionType as any;
  });
  const [delayLeft, setDelayLeft] = useState(() => {
    const base = settings.baseDelay + (settings.escalating ? app.overridesToday * 15 : 0);
    return base;
  });
  const [typed, setTyped] = useState('');
  const passage = useMemo(() => {
    const idx = Math.min(TYPING_PASSAGES.length - 1, app.overridesToday);
    // longer text for higher overrides
    if (app.overridesToday >= 2) return TYPING_PASSAGES[idx] + ' ' + TYPING_PASSAGES[(idx + 1) % TYPING_PASSAGES.length];
    return TYPING_PASSAGES[idx];
  }, [app.overridesToday]);

  const isTypingCorrect = typed.trim() === passage.trim();
  const progress = passage.length > 0 ? Math.min(1, typed.length / passage.length) : 0;

  // Delay countdown
  useEffect(() => {
    if (stage !== 'friction' || frictionMode !== 'delay') return;
    if (delayLeft <= 0) return;
    const t = setInterval(() => setDelayLeft(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [stage, frictionMode, delayLeft]);

  const breatheScale = useSharedValue(1);
  useEffect(() => {
    breatheScale.value = withRepeat(withTiming(1.25, { duration: 3000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breatheScale.value }],
  }));

  const handleOverride = () => {
    setStage('success');
    setTimeout(onSuccess, 1200);
  };

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <View style={styles.blockOverlay}>
        <View style={styles.blockHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[styles.appIconWrap, { backgroundColor: app.color, borderColor: '#fff2', width: 40, height: 40 }]}>
              <Ionicons name={app.icon} size={20} color="#fff" />
            </View>
            <View>
              <Text style={styles.blockAppName}>{app.name.toUpperCase()} IS BLOCKED</Text>
              <Text style={styles.blockSub}>You hit your {app.limit} min daily limit</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.blockCloseBtn}>
            <Ionicons name="close" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          {stage === 'intro' && (
            <Animated.View entering={FadeIn} style={{ gap: 24 }}>
              <View style={styles.blockBigCard}>
                <View style={styles.blockStopIcon}>
                  <Ionicons name="hand-left" size={40} color={COLORS.red} />
                </View>
                <Text style={styles.blockTitle}>Take a breath.{'\n'}This is the friction{'\n'}you asked for.</Text>
                <Text style={styles.blockBody}>
                  You set this limit because you wanted to protect your own attention. {app.overridesToday > 0 ? `You've overridden ${app.overridesToday} time${app.overridesToday > 1 ? 's' : ''} today — so this gets harder.` : 'This is your first block today, so staying kind.'}
                </Text>

                <View style={styles.blockStatsRow}>
                  <View style={styles.blockStat}>
                    <Text style={styles.blockStatVal}>{Math.floor(app.usedToday)}m</Text>
                    <Text style={styles.blockStatLabel}>USED TODAY</Text>
                  </View>
                  <View style={styles.blockDivider} />
                  <View style={styles.blockStat}>
                    <Text style={styles.blockStatVal}>{app.limit}m</Text>
                    <Text style={styles.blockStatLabel}>YOUR LIMIT</Text>
                  </View>
                  <View style={styles.blockDivider} />
                  <View style={styles.blockStat}>
                    <Text style={[styles.blockStatVal, { color: COLORS.lime }]}>{app.overridesToday}</Text>
                    <Text style={styles.blockStatLabel}>OVERRIDES</Text>
                  </View>
                </View>
              </View>

              <View style={{ gap: 12 }}>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => setStage('friction')}>
                  <Text style={styles.primaryBtnText}>I WANT TO CONTINUE ANYWAY</Text>
                  <Ionicons name="arrow-forward" size={18} color={COLORS.bg} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostBtn} onPress={onClose}>
                  <Ionicons name="leaf-outline" size={18} color="#fff" />
                  <Text style={styles.ghostBtnText}>LEAVE & PROTECT MY FOCUS</Text>
                </TouchableOpacity>
                {settings.accountabilityEnabled && settings.partnerContact ? (
                  <View style={styles.accountabilityNote}>
                    <Ionicons name="people-outline" size={14} color={COLORS.amber} />
                    <Text style={styles.accountabilityText}>{settings.partnerContact} will be notified if you override</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.blockFootNote}>
                <Ionicons name="lock-closed-outline" size={12} color="#fff6" />
                <Text style={styles.blockFootText}>This screen can't be swiped away. Android overlay + back-button lock in real build.</Text>
              </View>
            </Animated.View>
          )}

          {stage === 'friction' && (
            <Animated.View entering={FadeIn} style={{ gap: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.eyebrowWhite}>FRICTION CHALLENGE • {frictionMode.toUpperCase()}</Text>
                <View style={[styles.trackedBadge, { backgroundColor: '#ffffff14' }]}>
                  <Text style={[styles.trackedBadgeText, { color: '#fff' }]}>OVERRIDE #{app.overridesToday + 1}</Text>
                </View>
              </View>

              {frictionMode === 'typing' ? (
                <View style={styles.frictionCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.frictionTitle}>Type this exactly to continue</Text>
                    <Text style={[styles.frictionProgress, isTypingCorrect && { color: COLORS.lime }]}>{Math.round(progress * 100)}%</Text>
                  </View>
                  <View style={styles.passageBox}>
                    <Text style={styles.passageText}>{passage}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: isTypingCorrect ? COLORS.lime : '#fff' }]} />
                  </View>
                  <TextInput
                    value={typed}
                    onChangeText={setTyped}
                    placeholder="Start typing the passage above..."
                    placeholderTextColor="#ffffff66"
                    style={styles.frictionInput}
                    multiline
                    autoFocus
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  {typed.length > 0 && typed !== passage.slice(0, typed.length) && (
                    <View style={styles.errorRow}>
                      <Ionicons name="alert-circle" size={14} color={COLORS.red} />
                      <Text style={styles.errorText}>Keep going — match it character for character. No copy-paste.</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    disabled={!isTypingCorrect}
                    style={[styles.primaryBtn, !isTypingCorrect && { opacity: 0.35 }]}
                    onPress={handleOverride}
                  >
                    <Text style={styles.primaryBtnText}>{isTypingCorrect ? 'UNLOCK 10 MIN EXTRA' : 'TYPE EXACTLY TO UNLOCK'}</Text>
                    <Ionicons name={isTypingCorrect ? "lock-open" : "keypad-outline"} size={18} color={COLORS.bg} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.frictionCard}>
                  <Text style={styles.frictionTitle}>Wait it out — breathe with the circle</Text>
                  <Text style={styles.frictionSub}>If you still want it after this, you can have 10 more minutes. Urges peak and pass.</Text>

                  <View style={styles.breatheWrap}>
                    <Animated.View style={[styles.breatheCircle, breatheStyle, delayLeft <= 0 && { backgroundColor: COLORS.lime }]} />
                    <View style={styles.breatheCenter}>
                      <Text style={styles.breatheNumber}>{delayLeft > 0 ? `${delayLeft}s` : '0s'}</Text>
                      <Text style={styles.breatheLabel}>{delayLeft > 0 ? 'BREATHE' : 'DONE'}</Text>
                    </View>
                  </View>

                  <View style={styles.quoteBox}>
                    <Text style={styles.quoteText}>"{QUOTES[app.overridesToday % QUOTES.length]}"</Text>
                  </View>

                  <View style={[styles.progressTrack, { height: 6 }]}>
                    <View style={[styles.progressFill, { width: `${100 - (delayLeft / (settings.baseDelay + app.overridesToday * 15)) * 100}%`, backgroundColor: COLORS.lime }]} />
                  </View>

                  <TouchableOpacity disabled={delayLeft > 0} style={[styles.primaryBtn, delayLeft > 0 && { opacity: 0.35 }]} onPress={handleOverride}>
                    <Text style={styles.primaryBtnText}>{delayLeft > 0 ? `WAIT ${delayLeft}s MORE` : 'I STILL WANT 10 MIN EXTRA'}</Text>
                    <Ionicons name={delayLeft > 0 ? "hourglass-outline" : "lock-open-outline"} size={18} color={COLORS.bg} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.ghostBtn} onPress={onClose}>
                    <Text style={styles.ghostBtnText}>I CHANGED MY MIND • CLOSE</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity onPress={() => setFrictionMode(frictionMode === 'typing' ? 'delay' : 'typing')} style={{ alignSelf: 'center', flexDirection: 'row', gap: 6, padding: 8 }}>
                <Ionicons name="swap-horizontal-outline" size={14} color="#fff8" />
                <Text style={{ color: '#fff8', fontSize: 12, fontWeight: '600' }}>Switch to {frictionMode === 'typing' ? 'DELAY' : 'TYPING'} instead</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {stage === 'success' && (
            <Animated.View entering={FadeIn} style={{ alignItems: 'center', gap: 16 }}>
              <View style={[styles.blockStopIcon, { backgroundColor: COLORS.lime, borderColor: COLORS.lime }]}>
                <Ionicons name="checkmark" size={36} color={COLORS.bg} />
              </View>
              <Text style={[styles.blockTitle, { textAlign: 'center' }]}>Override granted.{'\n'}+10 minutes.</Text>
              <Text style={[styles.blockBody, { textAlign: 'center' }]}>Next time will be harder. Your accountability {settings.accountabilityEnabled ? 'partner has been noted' : 'log has been updated'}.</Text>
            </Animated.View>
          )}
        </ScrollView>

        <View style={styles.blockSystemBar}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.lime }} />
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>FRICTION IS TRACKING</Text>
          </View>
          <Text style={{ color: '#fff8', fontSize: 10 }}>{new Date().toLocaleTimeString()}</Text>
        </View>
      </View>
    </Modal>
  );
}

// --- Onboarding ---
function OnboardingModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    { title: 'Free app blocker.\nNo paywall. Ever.', body: 'Paid blockers hide enforcement behind subscriptions. Friction is built to be free, offline, and shareable as APK or on Play Store.', icon: 'shield-checkmark' as any },
    { title: 'Any app, your limit.', body: 'Not hardcoded to Instagram. Pick any app, set a daily budget. When you hit it, Friction hard-blocks with real friction you designed.', icon: 'apps' as any },
    { title: 'Friction > Deletion', body: 'Goal isn’t to make apps unusable. It’s to make mindless use require a deliberate, slightly annoying choice. Typing challenge or forced delay, escalating each time.', icon: 'hand-left' as any },
  ];
  const s = steps[step];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', padding: 24 }}>
        <View style={{ gap: 24 }}>
          <View style={[styles.appIconWrap, { width: 64, height: 64, borderRadius: 20, backgroundColor: COLORS.limeBg, borderColor: COLORS.lime + '33' }]}>
            <Ionicons name={s.icon} size={32} color={COLORS.lime} />
          </View>
          <Text style={[styles.h1, { fontSize: 30, lineHeight: 34 }]}>{s.title}</Text>
          <Text style={styles.subHeader}>{s.body}</Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            {steps.map((_, i) => (
              <View key={i} style={{ height: 4, flex: 1, borderRadius: 2, backgroundColor: i === step ? COLORS.lime : COLORS.border }} />
            ))}
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => step < 2 ? setStep(step + 1) : onClose()}>
            <Text style={styles.primaryBtnText}>{step < 2 ? 'CONTINUE' : 'START PROTECTING FOCUS'}</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.bg} />
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={{ alignSelf: 'center', padding: 8 }}>
            <Text style={{ color: COLORS.textFaint, fontSize: 12, fontWeight: '600' }}>SKIP FOR NOW</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { color: COLORS.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  eyebrowWhite: { color: '#fff8', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  h1: { color: COLORS.text, fontSize: 28, fontWeight: '800', lineHeight: 30, letterSpacing: -0.5 },
  subHeader: { color: COLORS.textDim, fontSize: 14, lineHeight: 20, marginTop: 8 },
  focusScoreWrap: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', minWidth: 72 },
  focusScore: { color: COLORS.lime, fontSize: 26, fontWeight: '900', lineHeight: 26 },
  focusLabel: { color: COLORS.textFaint, fontSize: 8, fontWeight: '800', letterSpacing: 1, marginTop: 4 },
  statsGrid: { flexDirection: 'row', gap: 12 },
  statCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 14 },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { color: COLORS.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  statValue: { color: COLORS.text, fontSize: 28, fontWeight: '800', marginTop: 8, letterSpacing: -0.5 },
  statSub: { color: COLORS.textFaint, fontSize: 11, marginTop: 2 },
  progressTrack: { height: 6, backgroundColor: COLORS.card2, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressGlow: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.amber, top: -7, opacity: 0.6 },
  liveBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.limeBg, borderWidth: 1, borderColor: COLORS.lime + '33', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.lime },
  liveText: { flex: 1, color: COLORS.lime, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  liveStop: { backgroundColor: COLORS.lime, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  liveStopText: { color: COLORS.bg, fontSize: 10, fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  sectionTitle: { color: COLORS.textFaint, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  sectionCount: { color: COLORS.textDim, fontSize: 11, fontWeight: '600' },
  appCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 14, gap: 12 },
  appCardBlocked: { borderColor: COLORS.redBorder, backgroundColor: COLORS.redBg },
  appCardSimming: { borderColor: COLORS.lime + '55', backgroundColor: COLORS.card },
  appCardTop: { flexDirection: 'row', alignItems: 'center' },
  appIconWrap: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  appName: { color: COLORS.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  appPackage: { color: COLORS.textDim, fontSize: 11, marginTop: 2 },
  appTimeMono: { color: COLORS.text, fontSize: 12, fontWeight: '700', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) as any },
  statusDotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  appCardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  smallBtnGhost: { borderColor: COLORS.border, backgroundColor: COLORS.card2 },
  smallBtnActive: { backgroundColor: COLORS.lime, borderColor: COLORS.lime },
  smallBtnActiveRed: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.red, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  smallBtnText: { color: COLORS.text, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  smallBtnTextRed: { color: '#fff', fontSize: 11, fontWeight: '800' },
  overrideText: { color: COLORS.textFaint, fontSize: 11 },
  blockBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.redBg, borderWidth: 1, borderColor: COLORS.redBorder, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  blockBadgeText: { color: COLORS.red, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12, backgroundColor: COLORS.card, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed' as any, paddingHorizontal: 24 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: COLORS.card2, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  emptySub: { color: COLORS.textDim, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  // Library
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 14, height: 46 },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 14 },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  pillActive: { backgroundColor: COLORS.text, borderColor: COLORS.text },
  pillText: { color: COLORS.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  pillTextActive: { color: COLORS.bg },
  pillHint: { color: COLORS.textFaint, fontSize: 11, fontWeight: '600' },
  libRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 12 },
  libRowTracked: { borderColor: COLORS.lime + '44', backgroundColor: COLORS.limeBg },
  trackedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.lime + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginRight: 8 },
  trackedBadgeText: { color: COLORS.lime, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.lime, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnTracked: { backgroundColor: COLORS.card2, borderWidth: 1, borderColor: COLORS.border },
  addBtnText: { color: COLORS.bg, fontSize: 12, fontWeight: '800' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderWidth: 1, borderColor: COLORS.border, borderBottomWidth: 0 },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.card2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  limitPreview: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 16, alignItems: 'center', gap: 6 },
  limitNumber: { color: COLORS.lime, fontSize: 56, fontWeight: '900', lineHeight: 56, letterSpacing: -2 },
  limitUnit: { color: COLORS.textFaint, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  limitHintRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 8, paddingHorizontal: 12 },
  limitHint: { color: COLORS.textDim, fontSize: 11, flex: 1, lineHeight: 14 },
  sliderRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 16 },
  sliderChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  sliderChipActive: { backgroundColor: COLORS.lime, borderColor: COLORS.lime },
  sliderChipText: { color: COLORS.textDim, fontSize: 12, fontWeight: '700' },
  sliderChipTextActive: { color: COLORS.bg },
  sliderBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  primaryBtn: { backgroundColor: COLORS.lime, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  primaryBtnText: { color: COLORS.bg, fontSize: 13, fontWeight: '900', letterSpacing: 0.6 },
  ghostBtn: { backgroundColor: '#ffffff12', borderWidth: 1, borderColor: '#ffffff1A', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ghostBtnText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  modalFoot: { color: COLORS.textFaint, fontSize: 10, textAlign: 'center', marginTop: 12, fontWeight: '600' },
  // Insights
  insightCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 16, gap: 12 },
  insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barChart: { flexDirection: 'row', gap: 10, height: 126, alignItems: 'flex-end', marginTop: 8 },
  barWrap: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { flex: 1, width: '100%', backgroundColor: COLORS.card2, borderRadius: 8, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 8 },
  barLabel: { color: COLORS.textFaint, fontSize: 10, fontWeight: '700' },
  barValue: { color: COLORS.textDim, fontSize: 9, fontWeight: '600' },
  insightFooter: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: COLORS.card2, borderRadius: 10, padding: 10 },
  insightFooterText: { color: COLORS.textDim, fontSize: 11, flex: 1, lineHeight: 14 },
  // Settings
  settingsGroup: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 14, gap: 12 },
  settingsGroupTitle: { color: COLORS.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  settingsDesc: { color: COLORS.textDim, fontSize: 12, lineHeight: 16 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card2, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, gap: 4 },
  settingsRowActive: { borderColor: COLORS.lime + '66', backgroundColor: COLORS.limeBg },
  settingsRowTitle: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  settingsRowSub: { color: COLORS.textDim, fontSize: 11, marginTop: 2, lineHeight: 14 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.border2, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: COLORS.lime },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.lime },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 12, height: 44 },
  input: { flex: 1, color: COLORS.text, fontSize: 13 },
  // Block Overlay
  blockOverlay: { flex: 1, backgroundColor: '#08080A' },
  blockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#ffffff14', paddingTop: 50 },
  blockAppName: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
  blockSub: { color: '#fff8', fontSize: 11, marginTop: 2 },
  blockCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ffffff14', alignItems: 'center', justifyContent: 'center' },
  blockBigCard: { backgroundColor: '#141417', borderWidth: 1, borderColor: '#ffffff14', borderRadius: 20, padding: 20, gap: 16, alignItems: 'center' },
  blockStopIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#1E1515', borderWidth: 1, borderColor: COLORS.redBorder, alignItems: 'center', justifyContent: 'center' },
  blockTitle: { color: '#fff', fontSize: 24, fontWeight: '800', lineHeight: 28, letterSpacing: -0.5, textAlign: 'center' },
  blockBody: { color: '#ffffff99', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  blockStatsRow: { flexDirection: 'row', backgroundColor: '#ffffff08', borderRadius: 14, padding: 12, width: '100%', justifyContent: 'space-around', marginTop: 8 },
  blockStat: { alignItems: 'center', gap: 4 },
  blockStatVal: { color: '#fff', fontSize: 18, fontWeight: '800' },
  blockStatLabel: { color: '#fff6', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  blockDivider: { width: 1, backgroundColor: '#ffffff14' },
  blockSystemBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 30, paddingTop: 12, backgroundColor: '#000' },
  blockFootNote: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  blockFootText: { color: '#fff6', fontSize: 10 },
  // Friction
  frictionCard: { backgroundColor: '#151519', borderWidth: 1, borderColor: '#ffffff14', borderRadius: 20, padding: 18, gap: 14 },
  frictionTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  frictionSub: { color: '#fff8', fontSize: 12, lineHeight: 16 },
  frictionProgress: { color: '#fff8', fontSize: 12, fontWeight: '800' },
  passageBox: { backgroundColor: '#ffffff08', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#ffffff10' },
  passageText: { color: '#ffffffBB', fontSize: 14, lineHeight: 20 },
  frictionInput: { backgroundColor: '#000', borderWidth: 1, borderColor: '#ffffff1A', borderRadius: 12, padding: 14, color: '#fff', minHeight: 90, fontSize: 14, lineHeight: 20 },
  errorRow: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: COLORS.redBg, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.redBorder },
  errorText: { color: COLORS.red, fontSize: 11, flex: 1 },
  breatheWrap: { alignItems: 'center', justifyContent: 'center', height: 160, marginVertical: 8 },
  breatheCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#ffffff12', borderWidth: 1, borderColor: '#ffffff22', position: 'absolute' },
  breatheCenter: { alignItems: 'center' },
  breatheNumber: { color: '#fff', fontSize: 36, fontWeight: '900' },
  breatheLabel: { color: '#fff8', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: 4 },
  quoteBox: { backgroundColor: '#ffffff08', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: COLORS.lime },
  quoteText: { color: '#ffffffCC', fontSize: 13, fontStyle: 'italic', lineHeight: 18 },
  accountabilityNote: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: 'rgba(255,176,32,0.1)', borderColor: 'rgba(255,176,32,0.2)', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  accountabilityText: { color: COLORS.amber, fontSize: 11, fontWeight: '600', flex: 1 },
});
