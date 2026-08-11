const fs = require('fs');
const path = require('path');

async function applyModifications() {
  const cwd = path.join('C:\\Users\\PC\\Documents\\Code\\Fitzo');
  
  const API_PATH = path.join(cwd, 'mobile', 'src', 'services', 'api.ts');
  const COMPONENTS_DIR = path.join(cwd, 'mobile', 'src', 'components');
  const COMPONENT_PATH = path.join(COMPONENTS_DIR, 'FoodDraftSheet.tsx');
  const SCREEN_PATH = path.join(cwd, 'mobile', 'src', 'screens', 'member', 'CalorieLogScreen.tsx');

  if (!fs.existsSync(COMPONENTS_DIR)) fs.mkdirSync(COMPONENTS_DIR, { recursive: true });

  if (fs.existsSync(API_PATH)) {
    let apiCode = fs.readFileSync(API_PATH, 'utf8');
    if (!apiCode.includes('extractFoods:')) {
      apiCode = apiCode.replace(/(export\s+const\s+aiAPI\s*=\s*\{)/, `$1\n  extractFoods: async (text: string) => { const res = await api.post('/api/ai/extract-foods', { text }); return res.data; },`);
    }
    if (!apiCode.includes('bulkResolve:')) {
      if (apiCode.includes('export const foodAPI')) {
        apiCode = apiCode.replace(/(export\s+const\s+foodAPI\s*=\s*\{)/, `$1\n  bulkResolve: async (items: any[]) => { const res = await api.post('/api/food/bulk-resolve', { items }); return res.data; },`);
      } else {
        apiCode += `\nexport const foodAPI = {\n  bulkResolve: async (items: any[]) => { const res = await api.post('/api/food/bulk-resolve', { items }); return res.data; }\n};\n`;
      }
    }
    fs.writeFileSync(API_PATH, apiCode);
    console.log('✅ Updated mobile/src/services/api.ts');
  }

  const componentCode = `import React, { useState, useEffect } from 'react';\nimport { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';\nimport { GlassCard } from './GlassCard';\nimport { Button } from './Button';\nimport { typography, theme } from '../styles/theme';\n\ninterface FoodItem {\n  id?: string;\n  name: string;\n  serving_size: string;\n  calories: number;\n  protein: number;\n  carbs: number;\n  fat: number;\n  source?: string;\n  is_estimate?: boolean;\n  quantity?: number;\n}\n\ninterface Props {\n  visible: boolean;\n  onClose: () => void;\n  items: FoodItem[];\n  onConfirm: (items: FoodItem[]) => void;\n}\n\nexport function FoodDraftSheet({ visible, onClose, items, onConfirm }: Props) {\n  const [drafts, setDrafts] = useState<FoodItem[]>([]);\n\n  useEffect(() => {\n    if (visible) setDrafts(items.map(item => ({ ...item, quantity: 1 })));\n  }, [visible, items]);\n\n  const updateQuantity = (index: number, delta: number) => {\n    setDrafts(prev => {\n      const updated = [...prev];\n      const newQ = (updated[index].quantity || 1) + delta;\n      if (newQ >= 1) updated[index].quantity = newQ;\n      return updated;\n    });\n  };\n\n  const removeItem = (index: number) => setDrafts(prev => prev.filter((_, i) => i !== index));\n\n  useEffect(() => {\n    if (visible && drafts.length === 0 && items.length > 0) onClose();\n  }, [drafts]);\n\n  return (\n    <Modal visible={visible} animationType="slide" transparent>\n      <View style={styles.overlay}>\n        <View style={styles.sheet}>\n          <Text style={[typography.h2, styles.title]}>Confirm Foods</Text>\n          <ScrollView style={{maxHeight:'80%'}}>\n            {drafts.map((item, index) => (\n              <GlassCard key={index} style={styles.card}>\n                <View style={styles.header}>\n                  <Text style={[typography.h3, styles.name]}>{item.name}</Text>\n                  {item.is_estimate && (\n                    <View style={styles.badge}>\n                      <Text style={styles.badgeText}>AI Estimate</Text>\n                    </View>\n                  )}\n                </View>\n                <Text style={typography.body}>Serving: {item.serving_size || '1 portion'}</Text>\n                <Text style={typography.body}>\n                  Cal: {(item.calories * (item.quantity||1)).toFixed(0)} | P: {(item.protein * (item.quantity||1)).toFixed(1)}g | C: {(item.carbs * (item.quantity||1)).toFixed(1)}g | F: {(item.fat * (item.quantity||1)).toFixed(1)}g\n                </Text>\n                <View style={styles.actions}>\n                   <View style={styles.quantity}>\n                     <TouchableOpacity onPress={() => updateQuantity(index, -1)} style={styles.btn}><Text style={styles.btnText}>-</Text></TouchableOpacity>\n                     <Text style={typography.body}>{item.quantity || 1}</Text>\n                     <TouchableOpacity onPress={() => updateQuantity(index, 1)} style={styles.btn}><Text style={styles.btnText}>+</Text></TouchableOpacity>\n                   </View>\n                   <TouchableOpacity onPress={() => removeItem(index)}>\n                     <Text style={{color: theme.colors.error || 'red'}}>Remove</Text>\n                   </TouchableOpacity>\n                </View>\n              </GlassCard>\n            ))}\n          </ScrollView>\n          <View style={styles.footer}>\n            <Button title="Cancel" onPress={onClose} variant="secondary" />\n            <Button title="Log Meal" onPress={() => onConfirm(drafts)} />\n          </View>\n        </View>\n      </View>\n    </Modal>\n  );\n}\n\nconst styles = StyleSheet.create({\n  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },\n  sheet: { backgroundColor: theme.colors.background || '#000', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },\n  title: { marginBottom: 15, color: theme.colors.text?.primary || '#fff' },\n  card: { marginBottom: 12, padding: 15 },\n  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },\n  name: { color: theme.colors.text?.primary || '#fff', flex: 1 },\n  badge: { backgroundColor: 'orange', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },\n  badgeText: { fontSize: 12, color: '#000', fontWeight: 'bold' },\n  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },\n  quantity: { flexDirection: 'row', alignItems: 'center', gap: 15 },\n  btn: { paddingHorizontal: 15, paddingVertical: 5, backgroundColor: theme.colors.glass?.surface || '#222', borderRadius: 8 },\n  btnText: { color: theme.colors.text?.primary || '#fff', fontSize: 16 },\n  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 10 }\n});`;
  fs.writeFileSync(COMPONENT_PATH, componentCode);
  console.log('✅ Created mobile/src/components/FoodDraftSheet.tsx');

  if (fs.existsSync(SCREEN_PATH)) {
    let screenCode = fs.readFileSync(SCREEN_PATH, 'utf8');
    if (!screenCode.includes('FoodDraftSheet')) {
      screenCode = screenCode.replace(/(import\s+.*?from\s+['"]react.*?['"];?\n)/i, `$1import { FoodDraftSheet } from '../../components/FoodDraftSheet';\n`);
      screenCode = screenCode.replace(/(export (?:default )?function \w+\(.*?\)\s*\{\s*\n?)/, `$1  const [draftItems, setDraftItems] = React.useState<any[]>([]);\n  const [showDraftSheet, setShowDraftSheet] = React.useState(false);\n\n`);

      const assignmentRegex = /([ \t]*)(?:const|let|var)\s+(\w+)\s*=\s*(await aiAPI\.transcribeAudio\(.*?\);)/g;
      let modified = false;
      screenCode = screenCode.replace(assignmentRegex, (match, spaces, varName, call) => {
        modified = true;
        return `${spaces}const ${varName} = ${call}\n${spaces}if (${varName}.success && ${varName}.text) {\n${spaces}   try {\n${spaces}       const extracted = await aiAPI.extractFoods(${varName}.text);\n${spaces}       if (extracted && extracted.items) {\n${spaces}           const resolved = await foodAPI.bulkResolve(extracted.items);\n${spaces}           setDraftItems(resolved.items);\n${spaces}           setShowDraftSheet(true);\n${spaces}       }\n${spaces}   } catch (e) {\n${spaces}       toast.error('Voice Extraction Failed', 'Try speaking fewer items at once.');\n${spaces}   }\n${spaces}}`;
      });
      if (!modified) {
          const directCallRegex = /([ \t]*)(await aiAPI\.transcribeAudio\(.*?\);)/;
          screenCode = screenCode.replace(directCallRegex, (match, spaces, call) => {
            return `${spaces}const transcription = ${call}\n${spaces}if (transcription.success && transcription.text) {\n${spaces}   try {\n${spaces}       const extracted = await aiAPI.extractFoods(transcription.text);\n${spaces}       if (extracted && extracted.items) {\n${spaces}           const resolved = await foodAPI.bulkResolve(extracted.items);\n${spaces}           setDraftItems(resolved.items);\n${spaces}           setShowDraftSheet(true);\n${spaces}       }\n${spaces}   } catch(e) {}\n${spaces}}`;
          });
      }

      screenCode = screenCode.replace(/(\n\s*)(<\/(?:SafeAreaView|View|ScrollView)>)(\s*\)?\s*;?\s*\}(?!\s*\}))/i, `$1  <FoodDraftSheet \n$1    visible={showDraftSheet} \n$1    onClose={() => setShowDraftSheet(false)} \n$1    items={draftItems} \n$1    onConfirm={(items) => {\n$1      console.log('Ready for backend bulk submission:', items);\n$1      setShowDraftSheet(false);\n$1    }} \n$1  />$1$2$3`);
      fs.writeFileSync(SCREEN_PATH, screenCode);
      console.log('✅ Updated mobile/src/screens/member/CalorieLogScreen.tsx');
    }
  }
}
applyModifications().catch(console.error);