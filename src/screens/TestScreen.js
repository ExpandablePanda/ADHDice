import React, { Suspense, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Canvas, useFrame, useLoader } from '@react-three/fiber/native';
import { useGLTF, PerspectiveCamera, Center, useTexture } from '@react-three/drei/native';
import { useTheme } from '../lib/ThemeContext';
import { useTasks, STATUSES, calculateTaskStreak } from '../lib/TasksContext';
import * as THREE from 'three';

function D6Model({ onReportNames }) {
  const meshRef = useRef();
  const { colors } = useTheme();
  const { scene } = useGLTF(require('../../assets/d6.glb'));
  
  useEffect(() => {
    if (!scene) return;
    const names = [];
    
    scene.traverse((child) => {
      if (child.isMesh) {
        names.push(child.name);
        if (child.material) {
          const isDots = child.name.includes('001');
          if (isDots) {
            child.material = new THREE.MeshStandardMaterial({
              color: new THREE.Color('#ffffff'),
              metalness: 0.0,
              roughness: 0.2, 
              emissive: new THREE.Color('#ffffff'),
              emissiveIntensity: 0.4 
            });
          } else {
            child.material = new THREE.MeshPhysicalMaterial({
              color: new THREE.Color('#4f46e5'), 
              transparent: true,
              opacity: 0.92, 
              roughness: 0.7, 
              metalness: 0.8, 
              clearcoat: 1.0, 
              clearcoatRoughness: 0.0, 
              reflectivity: 0.5 
            });
          }
          child.material.needsUpdate = true;
        }
      }
    });
    onReportNames(names);
  }, [scene]);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 1.0;
      meshRef.current.rotation.x += delta * 0.4;
    }
  });

  return <primitive ref={meshRef} object={scene} scale={0.5} />;
}

// Helper to generate a rounded rectangle shape for "Chips"
function createRoundedRectShape(width, height, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x, y + radius);
  shape.lineTo(x, y + height - radius);
  shape.quadraticCurveTo(x, y + height, x + radius, y + height);
  shape.lineTo(x + width - radius, y + height);
  shape.quadraticCurveTo(x + width, y + height, x + width, y + height - radius);
  shape.lineTo(x + width, y + radius);
  shape.quadraticCurveTo(x + width, y, x + width - radius, y);
  shape.lineTo(x + radius, y);
  shape.quadraticCurveTo(x, y, x, y + radius);
  return shape;
}

function Chip({ position, width, height, color, maskTexture }) {
  const radius = height / 2.2; // Approximate "Pill" look
  const shape = React.useMemo(() => createRoundedRectShape(width, height, radius), [width, height, radius]);

  return (
    <group position={position}>
      {/* 1. The Pill Background (Rounded Geometry) */}
      <mesh>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* 2. The Text Overlay (Alpha Masked) */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#000000" alphaMap={maskTexture} transparent={true} alphaTest={0.5} />
      </mesh>
    </group>
  );
}


function CardsModel({ onReportNames, testTask }) {
  const groupRef = useRef();
  const { scene } = useGLTF(require('../../assets/playing_cards.glb'));

  // ── Real task data ────────────────────────────────────────────────────────
  const taskTitle   = testTask?.title         || 'Take out trash';
  const taskId      = testTask?.id            || '20304540';
  const status      = testTask?.status        || 'active';
  const energy      = testTask?.energy        || 5;
  const tags        = testTask?.tags          || ['Home', 'Rapid'];
  const dueDate     = testTask?.dueDate       || null;
  const statusHistory = testTask?.statusHistory || {};

  const statusInfo  = STATUSES[status] || STATUSES.active;
  const statusLabel = statusInfo.label;

  // Streak calculation
  const streak = calculateTaskStreak(statusHistory);

  // Due date label
  const dueDateLabel = dueDate
    ? `DUE ${dueDate.replace(/(\d{4})-(\d{2})-(\d{2})/, '$2/$3')}`
    : 'NO DUE DATE';

  // ── Logo texture (back) ───────────────────────────────────────────────────
  const iconTexture = useTexture(require('../../assets/logo.png'));

  // ── Alpha mask URL generator ──────────────────────────────────────────────
  const maskUrl = (text, w, h) =>
    `https://placehold.co/${w}x${h}/000000/FFFFFF.png?text=${encodeURIComponent(text)}&font=montserrat`;

  // ── Load all mask textures at top level (no hooks in loops) ───────────────
  const idMaskTexture     = useLoader(THREE.TextureLoader, maskUrl(`ID: ${taskId}`, 400, 100));
  const statusMaskTexture = useLoader(THREE.TextureLoader, maskUrl(statusLabel.toUpperCase(), 400, 100));
  const energyMaskTexture = useLoader(THREE.TextureLoader, maskUrl(`ENERGY  ${energy}`, 300, 100));
  const titleMaskTexture  = useLoader(THREE.TextureLoader, maskUrl(taskTitle, 800, 300));
  const dueMaskTexture    = useLoader(THREE.TextureLoader, maskUrl(dueDateLabel, 500, 100));
  const streakMaskTexture  = useLoader(THREE.TextureLoader, maskUrl(streak > 0 ? `STREAK  ${streak}` : 'NO STREAK', 400, 100));
  const historyMaskTexture = useLoader(THREE.TextureLoader, maskUrl('HISTORY', 300, 100));

  // Tag textures — useLoader supports an array of URLs
  const tagUrls = tags.map(t => maskUrl(t.toUpperCase(), 300, 100));
  const tagMaskTextures = useLoader(THREE.TextureLoader, tagUrls);

  // ── Prep all textures ─────────────────────────────────────────────────────
  React.useMemo(() => {
    const all = [iconTexture, idMaskTexture, statusMaskTexture, energyMaskTexture,
                 titleMaskTexture, dueMaskTexture, streakMaskTexture, historyMaskTexture, ...tagMaskTextures];
    all.forEach(tex => {
      if (tex) { tex.premultiplyAlpha = false; tex.generateMipmaps = false; tex.needsUpdate = true; }
    });
  }, [iconTexture, idMaskTexture, statusMaskTexture, energyMaskTexture,
      titleMaskTexture, dueMaskTexture, streakMaskTexture, historyMaskTexture, tagMaskTextures]);

  // ── Clone card meshes ─────────────────────────────────────────────────────
  const { frontCard, backCard } = React.useMemo(() => {
    if (!scene) return { frontCard: null, backCard: null };
    let front = null, back = null;
    const names = [];
    scene.traverse((child) => {
      if (child.isMesh) {
        names.push(child.name);
        if (child.name === 'base_card1_Guzma_0')    front = child.clone();
        else if (child.name === 'base_card2_Lusamine_0') back = child.clone();
      }
    });
    if (onReportNames) onReportNames(names);
    if (front) front.material = new THREE.MeshBasicMaterial({ color: '#4f46e5' });
    if (back)  back.material  = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    return { frontCard: front, backCard: back };
  }, [scene, onReportNames]);

  if (!frontCard || !backCard) return null;

  // ── Layout helpers ────────────────────────────────────────────────────────
  const chipW = (text, pad = 0.2) => text.length * 0.045 + pad;

  const statusW = chipW(statusLabel);
  const dueW    = chipW(dueDateLabel, 0.25);
  const streakW = chipW(streak > 0 ? `STREAK  ${streak}` : 'NO STREAK', 0.25);

  // Centered tag row layout
  const tagsData = tags.map((t, i) => ({ text: t, width: chipW(t), mask: tagMaskTextures[i] }));
  const tagRowW  = tagsData.reduce((a, t) => a + t.width + 0.08, 0) - 0.08;

  return (
    <Center>
      <group ref={groupRef}>

        {/* ── Floating ID tag above card ─────────────────────────────────── */}
        <group position={[0, 1.25, 0.05]}>
          <mesh>
            <planeGeometry args={[1.0, 0.25]} />
            <meshBasicMaterial color="#ffffff" alphaMap={idMaskTexture} transparent alphaTest={0.5} />
          </mesh>
        </group>

        {/* ── FRONT CARD (Guzma - Indigo) ───────────────────────────────── */}
        <group position={[0, 0, 0.005]}>
          <primitive object={frontCard} scale={1.4} />

          {/* ROW 1: Status (left) | Energy (right) */}
          <Chip position={[-0.72 + statusW / 2, 0.82, 0.12]} width={statusW} height={0.2} color="#ffffff" maskTexture={statusMaskTexture} />
          <Chip position={[0.55, 0.82, 0.12]} width={0.48} height={0.2} color="#ffffff" maskTexture={energyMaskTexture} />

          {/* ROW 2: Due date (left) | Streak (right) */}
          <Chip position={[-0.72 + dueW / 2, 0.54, 0.12]} width={dueW} height={0.2} color="#ffffff" maskTexture={dueMaskTexture} />
          <Chip position={[0.72 - streakW / 2, 0.54, 0.12]} width={streakW} height={0.2} color="#ffffff" maskTexture={streakMaskTexture} />

          {/* CENTER: Task title */}
          <mesh position={[0, 0.08, 0.12]}>
            <planeGeometry args={[1.6, 0.55]} />
            <meshBasicMaterial color="#ffffff" alphaMap={titleMaskTexture} transparent alphaTest={0.5} />
          </mesh>

          {/* HISTORY chip — tappable, opens history menu */}
          <Chip position={[0, -0.38, 0.12]} width={0.58} height={0.2} color="#ffffff" maskTexture={historyMaskTexture} />

          {/* FOOTER: Tag chips row */}
          <group position={[0, -0.65, 0.12]}>
            {tagsData.map((tag, i) => {
              let xOffset = -tagRowW / 2;
              for (let j = 0; j < i; j++) xOffset += tagsData[j].width + 0.08;
              return (
                <Chip
                  key={i}
                  position={[xOffset + tag.width / 2, 0, 0]}
                  width={tag.width}
                  height={0.2}
                  color="#ffffff"
                  maskTexture={tag.mask}
                />
              );
            })}
          </group>
        </group>

        {/* ── BACK CARD (Lusamine - White) ──────────────────────────────── */}
        <group position={[0, 0, -0.005]} rotation={[0, Math.PI, 0]}>
          <primitive object={backCard} scale={1.4} />
          <mesh position={[0, 0, 0.05]}>
            <planeGeometry args={[1.4, 0.7]} />
            <meshBasicMaterial map={iconTexture} transparent alphaTest={0.1} />
          </mesh>
        </group>

      </group>
    </Center>
  );
}
export default function TestScreen() {
  const { colors } = useTheme();
  const { tasks } = useTasks();
  const [meshNames, setMeshNames] = React.useState([]);
  const [cardMeshNames, setCardMeshNames] = React.useState([]);
  
  const sampleTask = tasks && tasks.length > 0 ? tasks[0] : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>D6 Model Test</Text>
      
      <View style={styles.canvasContainer}>
        <Canvas style={{ flex: 1 }} alpha legacy samples={0}>
          <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={40} />
          <ambientLight intensity={1.5} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          <pointLight position={[-5, 5, 5]} intensity={1.5} />
          
          <Suspense fallback={null}>
            <D6Model onReportNames={setMeshNames} />
          </Suspense>
        </Canvas>
      </View>

      <View style={{ padding: 10, backgroundColor: '#eee', borderRadius: 10, width: '90%' }}>
        <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Found Meshes:</Text>
        {meshNames.map((n, i) => (
          <Text key={i} style={{ fontSize: 12 }}>• {n || '(unnamed)'}</Text>
        ))}
        {meshNames.length === 0 && <Text style={{ fontSize: 12 }}>Scanning...</Text>}
      </View>
      
      <Text style={[styles.subtitle, { color: colors.textSecondary, marginTop: 15 }]}>
        Sanity Test: If the list above shows names like 'Sphere' or 'Mesh', let me know!
      </Text>

      <Text style={[styles.title, { color: colors.textPrimary, marginTop: 50 }]}>Playing Cards Test</Text>
      
      <View style={[styles.canvasContainer, { backgroundColor: '#d1d5db' }]}>
        <Canvas style={{ flex: 1 }} alpha legacy samples={0}>
          <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={40} />
          <ambientLight intensity={1.5} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          <pointLight position={[-5, 5, 5]} intensity={1.5} />
          
          <Suspense fallback={null}>
            <CardsModel onReportNames={setCardMeshNames} testTask={sampleTask} />
          </Suspense>
        </Canvas>
      </View>

      <View style={{ padding: 10, backgroundColor: '#eee', borderRadius: 10, width: '90%' }}>
        <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Card Meshes Found:</Text>
        {cardMeshNames.map((n, i) => (
          <Text key={i} style={{ fontSize: 12 }}>• {n || '(unnamed)'}</Text>
        ))}
        {cardMeshNames.length === 0 && <Text style={{ fontSize: 12 }}>Scanning...</Text>}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  canvasContainer: {
    width: 300,
    height: 300,
    backgroundColor: 'transparent',
    marginVertical: 30,
    borderRadius: 20,
    overflow: 'hidden',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
