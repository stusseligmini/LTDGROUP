import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BiometricService from '../native/BiometricService';
import { useAuth } from '../providers/AuthProvider';

export default function SettingsScreen() {
  const { logout } = useAuth();
  const navigation = useNavigation();

  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [showSeed, setShowSeed] = useState(false);

  useEffect(() => {
    initializeSettings();
  }, []);

  const initializeSettings = async () => {
    try {
      // Check biometric availability
      const available = await BiometricService.isBiometricAvailable();
      setBiometricAvailable(available);

      // Load biometric preference
      const biometricPref = await AsyncStorage.getItem('biometric_enabled');
      setBiometricEnabled(biometricPref === 'true');

      // Load other preferences
      const darkModePref = await AsyncStorage.getItem('dark_mode');
      setDarkMode(darkModePref !== 'false');

      const notificationsPref = await AsyncStorage.getItem('notifications_enabled');
      setNotifications(notificationsPref !== 'false');
    } catch (error) {
      console.error('Error initializing settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricToggle = async (value: boolean) => {
    try {
      if (value) {
        // Request biometric authentication
        const authenticated = await BiometricService.authenticate();
        if (authenticated) {
          setBiometricEnabled(true);
          await AsyncStorage.setItem('biometric_enabled', 'true');
          Alert.alert('Success', 'Biometric authentication enabled');
        }
      } else {
        setBiometricEnabled(false);
        await AsyncStorage.setItem('biometric_enabled', 'false');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error updating biometric setting';
      Alert.alert('Error', message);
    }
  };

  const handleDarkModeToggle = async (value: boolean) => {
    setDarkMode(value);
    await AsyncStorage.setItem('dark_mode', value ? 'true' : 'false');
  };

  const handleNotificationsToggle = async (value: boolean) => {
    setNotifications(value);
    await AsyncStorage.setItem('notifications_enabled', value ? 'true' : 'false');
  };

  const handleBackup = () => {
    navigation.navigate('Backup');
  };

  const handleChangePassword = () => {
    navigation.navigate('ChangePassword');
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Logout',
          onPress: async () => {
            await logout();
          },
          style: 'destructive',
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔒 Security</Text>

        {biometricAvailable && (
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Biometric Authentication</Text>
              <Text style={styles.settingDescription}>
                {biometricEnabled ? 'Enabled' : 'Use fingerprint or face'}
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
              trackColor={{ false: '#334155', true: '#6366F1' }}
              thumbColor="#FFFFFF"
            />
          </View>
        )}

        <TouchableOpacity style={styles.settingItem} onPress={handleChangePassword}>
          <View style={styles.settingLeft}>
            <Text style={styles.settingLabel}>Change Password</Text>
            <Text style={styles.settingDescription}>Update your wallet password</Text>
          </View>
          <Text style={styles.settingArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem} onPress={handleBackup}>
          <View style={styles.settingLeft}>
            <Text style={styles.settingLabel}>Backup Wallet</Text>
            <Text style={styles.settingDescription}>Create encrypted backup</Text>
          </View>
          <Text style={styles.settingArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Preferences</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Text style={styles.settingLabel}>Dark Mode</Text>
            <Text style={styles.settingDescription}>Always enabled</Text>
          </View>
          <Switch
            value={darkMode}
            onValueChange={handleDarkModeToggle}
            trackColor={{ false: '#334155', true: '#6366F1' }}
            thumbColor="#FFFFFF"
            disabled
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Text style={styles.settingLabel}>Notifications</Text>
            <Text style={styles.settingDescription}>
              {notifications ? 'On' : 'Off'}
            </Text>
          </View>
          <Switch
            value={notifications}
            onValueChange={handleNotificationsToggle}
            trackColor={{ false: '#334155', true: '#6366F1' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ℹ️ About</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Text style={styles.settingLabel}>App Version</Text>
            <Text style={styles.settingDescription}>1.0.0</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => {
            Alert.alert(
              'Privacy Policy',
              'View privacy policy in browser',
              [{ text: 'OK' }]
            );
          }}
        >
          <View style={styles.settingLeft}>
            <Text style={styles.settingLabel}>Privacy Policy</Text>
            <Text style={styles.settingDescription}>Read our privacy policy</Text>
          </View>
          <Text style={styles.settingArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => {
            Alert.alert(
              'Terms of Service',
              'View terms in browser',
              [{ text: 'OK' }]
            );
          }}
        >
          <View style={styles.settingLeft}>
            <Text style={styles.settingLabel}>Terms of Service</Text>
            <Text style={styles.settingDescription}>Read our terms</Text>
          </View>
          <Text style={styles.settingArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.dangerButton}
          onPress={handleLogout}
        >
          <Text style={styles.dangerButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Warning */}
      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>⚠️ Important</Text>
        <Text style={styles.warningText}>
          Always keep your backup secure and never share it with anyone. Your seed phrase is the only way to recover your wallet.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  section: {
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  settingLeft: {
    flex: 1,
  },
  settingLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    color: '#94A3B8',
    fontSize: 13,
  },
  settingArrow: {
    color: '#94A3B8',
    fontSize: 20,
    marginLeft: 12,
  },
  dangerButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 16,
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  warningBox: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 24,
    marginBottom: 32,
  },
  warningTitle: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  warningText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
});
