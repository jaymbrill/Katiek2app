import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';

function TabIcon({ icon, label, focused }: { icon: string; label: string; focused: boolean }) {
  return (
    <View style={tabStyles.wrap}>
      <Text style={[tabStyles.icon, focused && tabStyles.iconFocused]}>{icon}</Text>
      <Text style={[tabStyles.label, focused && tabStyles.labelFocused]}>{label}</Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 4 },
  icon: { fontSize: 20, opacity: 0.4 },
  iconFocused: { opacity: 1 },
  label: { fontSize: 10, color: '#475569', marginTop: 2, fontWeight: '600' },
  labelFocused: { color: '#3b82f6' },
});

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#080f1e',
          borderTopColor: '#1e293b',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarShowLabel: false,
        headerStyle: { backgroundColor: '#080f1e' },
        headerTintColor: '#f1f5f9',
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon icon="🏔" label="Group" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="conditions"
        options={{
          title: 'Conditions',
          tabBarIcon: ({ focused }) => <TabIcon icon="🌡" label="Weather" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="gear"
        options={{
          title: 'Gear',
          tabBarIcon: ({ focused }) => <TabIcon icon="🎒" label="Gear" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon icon="👤" label="Profile" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
