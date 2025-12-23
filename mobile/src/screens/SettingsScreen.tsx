import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react';
import { useAuth } from '../providers/AuthProvider';
import BiometricService from '../native/BiometricService';

export default function SettingsScreen() {
  const { user, logout } = useAuth();

  const handleBiometricSetup = async () => {
    const capabilities = await BiometricService.isBiometricAvailable();
    
    if (capabilities.available) {
      const result = await BiometricService.authenticate('Set up biometric authentication');
      if (result.success) {
        await BiometricService.createKeys();
        alert('Biometric authentication enabled');
      }
    } else {
      alert('Biometric authentication not available on this device');
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        
        <TouchableOpacity style={styles.settingItem} onPress={handleBiometricSetup}>
          <Text style={styles.settingLabel}>Biometric Authentication</Text>
          <Text style={styles.settingValue}>Configure</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        
        <TouchableOpacity style={styles.settingItem} onPress={handleLogout}>
          <Text style={[styles.settingLabel, styles.logoutText]}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 20,
    backgroundColor: '#6366f1',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#e0e7ff',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 16,
    color: '#111827',
  },
  settingValue: {
    fontSize: 14,
    color: '#6366f1',
  },
  logoutText: {
    color: '#ef4444',
  },
});

