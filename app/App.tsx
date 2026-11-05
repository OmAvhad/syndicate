import React, { useState } from 'react'
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { LayoutDashboard, Compass, User, ShieldCheck } from 'lucide-react-native'
import { ThemeProvider, useTheme } from './src/context/ThemeContext'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import { TradeProvider } from './src/context/TradeContext'
import { BrandHeader } from './src/components/BrandHeader'
import { LoginScreen } from './src/screens/auth/LoginScreen'
import { DashboardScreen } from './src/screens/main/DashboardScreen'
import { DiscoverScreen } from './src/screens/main/DiscoverScreen'
import { ProfileScreen } from './src/screens/main/ProfileScreen'

type TabType = 'dashboard' | 'discover' | 'profile'

function MainNavigator() {
  const { isAuthenticated, isLoading } = useAuth()
  const { colors, mode } = useTheme()
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard')

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <View style={[styles.spinnerBox, { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder }]}>
          <ShieldCheck size={28} color={colors.accent} strokeWidth={2.2} />
        </View>
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>INITIALISING SYNDICATE ZK...</Text>
      </View>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return (
    <View style={[styles.mainContainer, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <BrandHeader subtitle="FOLLOWER DESK" />

      {/* Screen Body */}
      <View style={styles.body}>
        {currentTab === 'dashboard' && (
          <DashboardScreen onNavigateDiscover={() => setCurrentTab('discover')} />
        )}
        {currentTab === 'discover' && <DiscoverScreen />}
        {currentTab === 'profile' && <ProfileScreen />}
      </View>

      {/* Bottom Tab Bar (Thumb Zone) */}
      <View style={[styles.tabBar, { backgroundColor: colors.surfaceSubtle, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setCurrentTab('dashboard')}
          activeOpacity={0.7}
        >
          <LayoutDashboard
            size={20}
            color={currentTab === 'dashboard' ? colors.accent : colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: currentTab === 'dashboard' ? colors.accent : colors.textMuted },
            ]}
          >
            Dashboard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setCurrentTab('discover')}
          activeOpacity={0.7}
        >
          <Compass
            size={20}
            color={currentTab === 'discover' ? colors.accent : colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: currentTab === 'discover' ? colors.accent : colors.textMuted },
            ]}
          >
            Discover
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setCurrentTab('profile')}
          activeOpacity={0.7}
        >
          <User
            size={20}
            color={currentTab === 'profile' ? colors.accent : colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: currentTab === 'profile' ? colors.accent : colors.textMuted },
            ]}
          >
            ZK Identity
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function ThemedAppContainer() {
  const { colors, mode } = useTheme()
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <AuthProvider>
        <TradeProvider>
          <MainNavigator />
        </TradeProvider>
      </AuthProvider>
    </SafeAreaView>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedAppContainer />
    </ThemeProvider>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  spinnerBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  loadingText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  mainContainer: {
    flex: 1,
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    width: '100%',
    alignSelf: 'center',
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
  },
  body: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
  },
  tabItem: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
})
