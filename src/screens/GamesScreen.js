import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Alert, Animated, Easing, Dimensions, Modal, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../lib/ThemeContext';
import { useEconomy } from '../lib/EconomyContext';
import ScrollToTop from '../components/ScrollToTop';
import { colors } from '../theme';
import { useTasks } from '../lib/TasksContext';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W = (SCREEN_W - 60) / 4;
const CARD_H = CARD_W * 1.4;

// ── Task pool for cards ──────────────────────────────────────────────────────
const VALUE_COLORS = {
  1: '#6b7280',
  2: '#0891b2',
  3: '#059669',
  4: '#d97706',
  5: '#ef4444',
};

const VALUE_LABELS = {
  1: '★',
  2: '★★',
  3: '★★★',
  4: '★★★★',
  5: '★★★★★',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let cardId = 0;
function makeCard(title, value) {
  return { id: cardId++, title, value };
}

function dealInitialCards(taskPool) {
  const shuffled = shuffle(taskPool).slice(0, 20);
  const cards = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 4; col++) {
      const taskTitle = shuffled[row * 4 + col]?.title || 'Unknown Task';
      cards.push(makeCard(taskTitle, row + 1));
    }
  }
  return cards;
}

function getUnusedTask(currentCards, taskPool) {
  const used = new Set(currentCards.map(c => c.title));
  const available = taskPool.filter(t => !used.has(t.title));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)].title;
}

// ═════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS (CARDS, PHASES)
// ═════════════════════════════════════════════════════════════════════════════

function GameCard({ card, faceDown, small, onPress, highlighted, dimmed }) {
  const valColor = VALUE_COLORS[card.value] || '#6b7280';

  if (faceDown) {
    return (
      <TouchableOpacity
        style={[
          styles.card,
          small && styles.cardSmall,
          styles.cardBack,
          dimmed && { opacity: 0.4 },
        ]}
        activeOpacity={0.8}
        onPress={onPress}
        disabled={!onPress}
      >
        <View style={styles.cardBackPattern}>
          <Ionicons name="diamond" size={small ? 16 : 24} color="rgba(255,255,255,0.3)" />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        small && styles.cardSmall,
        { borderColor: valColor },
        highlighted && { borderColor: '#fbbf24', borderWidth: 3, shadowColor: '#fbbf24', shadowOpacity: 0.4, shadowRadius: 12 },
        dimmed && { opacity: 0.4 },
      ]}
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.cardCorner}>
        <Text style={[styles.cardValue, { color: valColor }]}>{card.value}</Text>
      </View>
      <View style={styles.cardCenterContent}>
        <Text style={[styles.cardTitle, small && { fontSize: 9 }]} numberOfLines={small ? 2 : 3}>
          {card.title}
        </Text>
      </View>
      <Text style={[styles.cardStars, { color: valColor }]}>
        {VALUE_LABELS[card.value]}
      </Text>
    </TouchableOpacity>
  );
}

function SetupPhase({ cards, onSwapCard, onShuffle }) {
  const rows = [0, 1, 2, 3, 4];
  return (
    <View style={styles.setupContainer}>
      <Text style={styles.phaseTitle}>Build Your Deck</Text>
      <Text style={styles.phaseHint}>Tap a card to swap it. Press Shuffle when ready!</Text>
      {rows.map(row => (
        <View key={row} style={styles.setupRow}>
          <View style={styles.rowLabel}>
            <Text style={[styles.rowLabelText, { color: VALUE_COLORS[row + 1] }]}>{row + 1}</Text>
          </View>
          {[0, 1, 2, 3].map(col => {
            const idx = row * 4 + col;
            const card = cards[idx];
            return <GameCard key={card.id} card={card} small onPress={() => onSwapCard(idx)} />;
          })}
        </View>
      ))}
      <TouchableOpacity style={styles.shuffleBtn} onPress={onShuffle}>
        <Ionicons name="shuffle" size={20} color="#fff" />
        <Text style={styles.shuffleBtnText}>Shuffle & Start War!</Text>
      </TouchableOpacity>
    </View>
  );
}

function BattlePhase({
  playerDeck, opponentDeck,
  playerCard, opponentCard,
  warStake,
  battleResult, isWar,
  onFlip, onResolve, onDoTask, onForfeit,
}) {
  const stakeContribution = Math.floor(warStake.length / 2);
  const playerCount = playerDeck.length + (playerCard ? 1 : 0) + stakeContribution;
  const opponentCount = opponentDeck.length + (opponentCard ? 1 : 0) + stakeContribution;

  return (
    <View style={styles.battleContainer}>
      <View style={styles.scoreBar}>
        <View style={styles.scoreItem}>
          <Ionicons name="person" size={16} color={colors.primary} />
          <Text style={styles.scoreLabel}>You</Text>
          <View style={[styles.scoreBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.scoreBadgeText}>{playerCount}</Text>
          </View>
        </View>
        <Text style={styles.vsText}>VS</Text>
        <View style={styles.scoreItem}>
          <Ionicons name="skull" size={16} color="#ef4444" />
          <Text style={styles.scoreLabel}>Opponent</Text>
          <View style={[styles.scoreBadge, { backgroundColor: '#ef4444' }]}>
            <Text style={styles.scoreBadgeText}>{opponentCount}</Text>
          </View>
        </View>
      </View>

      {warStake.length > 0 && (
        <View style={styles.warStakeBar}>
          <Ionicons name="flame" size={16} color="#ef4444" />
          <Text style={styles.warStakeText}>{Math.floor(warStake.length / 2) + 1} cards to steal!</Text>
        </View>
      )}

      <View style={styles.battleField}>
        <View style={styles.battleSide}>
          <Text style={styles.sideLabel}>Your Card</Text>
          {playerCard ? <GameCard card={playerCard} /> : playerDeck.length > 0 ? <GameCard card={playerDeck[0]} faceDown /> : <View style={[styles.card, styles.emptySlot]}><Text style={styles.emptySlotText}>Empty</Text></View>}
        </View>
        <View style={styles.battleCenter}>
          {battleResult === 'war' && <View style={styles.warBadge}><Text style={styles.warBadgeText}>WAR!</Text></View>}
          {battleResult === 'player' && <Ionicons name="arrow-back" size={28} color={colors.primary} />}
          {battleResult === 'opponent' && <Ionicons name="arrow-forward" size={28} color="#ef4444" />}
          {!battleResult && <Ionicons name="flash" size={24} color={colors.textMuted} />}
        </View>
        <View style={styles.battleSide}>
          <Text style={styles.sideLabel}>Opponent</Text>
          {opponentCard ? <GameCard card={opponentCard} /> : opponentDeck.length > 0 ? <GameCard card={opponentDeck[0]} faceDown /> : <View style={[styles.card, styles.emptySlot]}><Text style={styles.emptySlotText}>Empty</Text></View>}
        </View>
      </View>

      {isWar && (
        <View style={styles.warCardsRow}>
          <View style={styles.warCardsStack}>
            {Array.from({ length: isWar.player || 0 }).map((_, i) => <View key={`pw${i}`} style={[styles.warMiniCard, { left: i * 8 }]}><Ionicons name="diamond" size={10} color="rgba(255,255,255,0.4)" /></View>)}
          </View>
          <Text style={styles.warMiddleText}>{isWar.player === isWar.opponent && isWar.player > 0 ? `${isWar.player} cards each` : `${isWar.player || 0} vs ${isWar.opponent || 0} cards`}</Text>
          <View style={styles.warCardsStack}>
            {Array.from({ length: isWar.opponent || 0 }).map((_, i) => <View key={`ow${i}`} style={[styles.warMiniCard, { left: i * 8 }]}><Ionicons name="diamond" size={10} color="rgba(255,255,255,0.4)" /></View>)}
          </View>
        </View>
      )}

      <View style={styles.actionArea}>
        {!playerCard && !opponentCard && playerDeck.length > 0 && opponentDeck.length > 0 && (
          <TouchableOpacity style={styles.warButton} onPress={onFlip}>
            <Ionicons name="flash" size={22} color="#fff" />
            <Text style={styles.warButtonText}>{isWar ? 'Flip Tiebreaker!' : 'War!'}</Text>
          </TouchableOpacity>
        )}
        {battleResult === 'player' && (
          <View style={styles.resultActions}>
            <Text style={styles.resultText}>🎉 You win this round!</Text>
            <TouchableOpacity style={styles.collectBtn} onPress={onResolve}><Text style={styles.collectBtnText}>Collect Cards</Text></TouchableOpacity>
          </View>
        )}
        {battleResult === 'opponent' && (
          <View style={styles.resultActions}>
            <Text style={styles.resultText}>😤 Opponent wins!</Text>
            <Text style={styles.taskPrompt}>Do this task to steal the card:</Text>
            <View style={styles.taskCard}><Text style={styles.taskCardText}>{opponentCard?.title}</Text></View>
            <View style={styles.stealRow}>
              <TouchableOpacity style={styles.doTaskBtn} onPress={onDoTask}><Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={styles.doTaskBtnText}>Did It! Steal Card</Text></TouchableOpacity>
              <TouchableOpacity style={styles.forfeitBtn} onPress={onForfeit}><Text style={styles.forfeitBtnText}>Forfeit</Text></TouchableOpacity>
            </View>
          </View>
        )}
        {battleResult === 'war' && (
          <View style={styles.resultActions}>
            <Text style={styles.warAnnounce}>⚔️ It's a tie — going to WAR!</Text>
            <TouchableOpacity style={styles.collectBtn} onPress={onResolve}><Text style={styles.collectBtnText}>Go to War!</Text></TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function WinScreen({ winner, onPlayAgain }) {
  const isPlayer = winner === 'player';
  return (
    <View style={styles.winContainer}>
      <Text style={styles.winEmoji}>{isPlayer ? '🏆' : '💀'}</Text>
      <Text style={styles.winTitle}>{isPlayer ? 'You Win!' : 'You Lost!'}</Text>
      <Text style={styles.winSub}>{isPlayer ? 'You captured all the cards!' : 'Your opponent took all your cards.'}</Text>
      <TouchableOpacity style={styles.playAgainBtn} onPress={onPlayAgain}><Ionicons name="refresh" size={20} color="#fff" /><Text style={styles.playAgainText}>Play Again</Text></TouchableOpacity>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// REWARD MODALS
// ═════════════════════════════════════════════════════════════════════════════

function RecordDiceModal({ visible, onReward, colors }) {
  const [step, setStep] = useState('rollBase'); // rollBase | showBase | rollMulti | result
  const [baseRoll, setBaseRoll] = useState(1);
  const [multiRoll, setMultiRoll] = useState(1);
  const spinVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) startRoll();
  }, [visible]);

  const startRoll = () => {
    setStep('rollBase');
    Animated.timing(spinVal, { toValue: 1, duration: 1500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      const base = Math.floor(Math.random() * 20) + 1;
      setBaseRoll(base);
      setStep('showBase');
      spinVal.setValue(0);
      
      setTimeout(() => {
        setStep('rollMulti');
        Animated.timing(spinVal, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
          const multi = Math.floor(Math.random() * 4) + 1;
          setMultiRoll(multi);
          setStep('result');
        });
      }, 1000);
    });
  };

  const pts = baseRoll * multiRoll;
  const xp = Math.floor(pts / 2);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={diceStyles.overlay}>
        <View style={diceStyles.body}>
          {step === 'rollBase' && (
            <View style={diceStyles.center}>
              <Text style={diceStyles.title}>NEW RECORD!</Text>
              <Text style={diceStyles.sub}>Rolling d20 Base Reward...</Text>
              <Animated.View style={{ transform: [{ rotate: spinVal.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '1080deg'] }) }] }}>
                <Ionicons name="dice" size={80} color={colors.amber} />
              </Animated.View>
            </View>
          )}
          {step === 'showBase' && (
            <View style={diceStyles.center}>
              <Text style={diceStyles.title}>You rolled a {baseRoll}!</Text>
              <Ionicons name="dice" size={80} color={colors.amber} />
            </View>
          )}
          {step === 'rollMulti' && (
            <View style={diceStyles.center}>
              <Text style={diceStyles.title}>Rolling d4 Multiplier...</Text>
              <View style={diceStyles.calcRow}>
                <View style={diceStyles.calcItem}><Text style={diceStyles.calcVal}>{baseRoll}</Text><Text style={diceStyles.calcLbl}>Base</Text></View>
                <Text style={diceStyles.calcOps}>x</Text>
                <Animated.View style={{ transform: [{ rotate: spinVal.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '1080deg'] }) }] }}>
                  <Ionicons name="dice" size={60} color={colors.primary} />
                </Animated.View>
              </View>
            </View>
          )}
          {step === 'result' && (
            <View style={diceStyles.center}>
              <Ionicons name="sparkles" size={48} color={colors.amber} />
              <Text style={diceStyles.title}>Legendary Gains!</Text>
              <View style={diceStyles.resultBox}>
                  <Text style={diceStyles.resultBig}>+{pts} Points</Text>
                  <Text style={diceStyles.resultSmall}>+{xp} XP</Text>
              </View>
              <TouchableOpacity style={[diceStyles.doneBtn, { backgroundColor: colors.primary }]} onPress={() => onReward(pts, xp)}>
                <Text style={diceStyles.doneText}>Claim Record Reward</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const diceStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 30 },
  body: { backgroundColor: '#fff', borderRadius: 24, padding: 30, alignItems: 'center' },
  center: { alignItems: 'center', gap: 16, width: '100%' },
  title: { fontSize: 24, fontWeight: '900', color: '#111827', textAlign: 'center' },
  sub: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  calcRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginVertical: 10 },
  calcItem: { alignItems: 'center' },
  calcVal: { fontSize: 32, fontWeight: '800', color: '#111827' },
  calcLbl: { fontSize: 12, color: '#9ca3af', textTransform: 'uppercase' },
  calcOps: { fontSize: 24, fontWeight: '800', color: '#d1d5db' },
  resultBox: { width: '100%', padding: 20, borderRadius: 16, backgroundColor: '#ecfdf5', alignItems: 'center', marginVertical: 10 },
  resultBig: { fontSize: 28, fontWeight: '900', color: '#059669' },
  resultSmall: { fontSize: 16, fontWeight: '700', color: '#10b981' },
  doneBtn: { width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  doneText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});

// ═════════════════════════════════════════════════════════════════════════════
// GAME SCREENS
// ═════════════════════════════════════════════════════════════════════════════

function WarGame({ onBack, tasks, colors }) {
  const taskPool = tasks.filter(t => t.status === 'pending');
  const [phase, setPhase] = useState('setup');
  const [setupCards, setSetupCards] = useState(() => taskPool.length >= 20 ? dealInitialCards(taskPool) : []);
  const [playerDeck, setPlayerDeck] = useState([]);
  const [opponentDeck, setOpponentDeck] = useState([]);
  const [playerCard, setPlayerCard]   = useState(null);
  const [opponentCard, setOpponentCard] = useState(null);
  const [battleResult, setBattleResult] = useState(null); 
  const [warStake, setWarStake]       = useState([]); 
  const [isWar, setIsWar]             = useState(false); 
  const [winner, setWinner]           = useState(null);

  useEffect(() => {
    if (phase === 'setup' && taskPool.length >= 20 && setupCards.length === 0) setSetupCards(dealInitialCards(taskPool));
  }, [taskPool, phase]);

  function swapCard(idx) {
    const newTask = getUnusedTask(setupCards, taskPool);
    if (!newTask) { Alert.alert('No More Tasks', 'All playable tasks are already in use!'); return; }
    setSetupCards(prev => { const next = [...prev]; next[idx] = makeCard(newTask, next[idx].value); return next; });
  }

  function startGame() {
    const shuffledCards = shuffle(setupCards);
    const half = Math.floor(shuffledCards.length / 2);
    setPlayerDeck(shuffledCards.slice(0, half));
    setOpponentDeck(shuffledCards.slice(half));
    setPlayerCard(null); setOpponentCard(null); setBattleResult(null); setWarStake([]); setIsWar(false); setWinner(null);
    setPhase('battle');
  }

  function flipCards() {
    if (playerDeck.length === 0 || opponentDeck.length === 0) return;
    const pCard = playerDeck[0]; const oCard = opponentDeck[0];
    setPlayerCard(pCard); setOpponentCard(oCard); setPlayerDeck(playerDeck.slice(1)); setOpponentDeck(opponentDeck.slice(1));
    if (pCard.value > oCard.value) setBattleResult('player');
    else if (oCard.value > pCard.value) setBattleResult('opponent');
    else setBattleResult('war');
  }

  function resolveRound() {
    if (battleResult === 'war') {
      if (playerDeck.length === 0 || opponentDeck.length === 0) { setWinner(playerDeck.length > 0 ? 'player' : 'opponent'); setPhase('win'); return; }
      const stake = [...warStake, playerCard, opponentCard];
      const pCount = Math.min(3, playerDeck.length - 1);
      const oCount = Math.min(3, opponentDeck.length - 1);
      setWarStake([...stake, ...playerDeck.slice(0, pCount), ...opponentDeck.slice(0, oCount)]);
      setPlayerDeck(playerDeck.slice(pCount)); setOpponentDeck(opponentDeck.slice(oCount));
      setPlayerCard(null); setOpponentCard(null); setBattleResult(null); setIsWar({ player: pCount, opponent: oCount });
      return;
    }
    const wonCards = [playerCard, opponentCard, ...warStake];
    setPlayerDeck([...playerDeck, ...shuffle(wonCards)]);
    setPlayerCard(null); setOpponentCard(null); setBattleResult(null); setWarStake([]); setIsWar(false);
    if (opponentDeck.length === 0) { setWinner('player'); setPhase('win'); }
  }

  function doTask() { resolveRound(); }
  function forfeitCards() { 
    const wonCards = [playerCard, opponentCard, ...warStake];
    setOpponentDeck([...opponentDeck, ...shuffle(wonCards)]);
    setPlayerCard(null); setOpponentCard(null); setBattleResult(null); setWarStake([]); setIsWar(false);
    if (playerDeck.length === 0) { setWinner('opponent'); setPhase('win'); }
  }
  function playAgain() { setSetupCards(dealInitialCards(taskPool)); setWinner(null); setPhase('setup'); }

  if (taskPool.length < 20) {
    return (
      <View style={hubStyles.gameWrapper}>
        <View style={styles.header}><TouchableOpacity onPress={onBack}><Ionicons name="arrow-back" size={24} color={colors.textSecondary}/></TouchableOpacity><Text style={styles.headerTitle}>Task War</Text></View>
        <View style={styles.emptyContainer}><Ionicons name="documents-outline" size={64} color="#ccc"/><Text style={styles.emptyTitle}>Not enough tasks</Text><Text style={styles.emptySub}>At least 20 tasks needed. You have {taskPool.length}.</Text></View>
      </View>
    );
  }

  return (
    <View style={hubStyles.gameWrapper}>
      <View style={styles.header}><TouchableOpacity onPress={onBack}><Ionicons name="arrow-back" size={24} color={colors.textSecondary}/></TouchableOpacity><Text style={styles.headerTitle}>Task War</Text></View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {phase === 'setup' && <SetupPhase cards={setupCards} onSwapCard={swapCard} onShuffle={startGame} />}
        {phase === 'battle' && <BattlePhase playerDeck={playerDeck} opponentDeck={opponentDeck} playerCard={playerCard} opponentCard={opponentCard} warStake={warStake} battleResult={battleResult} isWar={isWar} onFlip={flipCards} onResolve={resolveRound} onDoTask={doTask} onForfeit={forfeitCards}/>}
        {phase === 'win' && <WinScreen winner={winner} onPlayAgain={playAgain} />}
      </ScrollView>
    </View>
  );
}

function FocusBreather({ onBack, colors }) {
  const [phase, setPhase] = useState('inhale');
  const [seconds, setSeconds] = useState(4);
  const breathAnim = useRef(new Animated.Value(1)).current;
  const { addReward } = useEconomy();

  useEffect(() => {
    let timer = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          if (phase === 'inhale') { setPhase('hold'); return 4; }
          if (phase === 'hold') { setPhase('exhale'); return 4; }
          if (phase === 'exhale') { setPhase('inhale'); return 4; }
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === 'inhale') Animated.timing(breathAnim, { toValue: 1.8, duration: 4000, easing: Easing.linear, useNativeDriver: true }).start();
    else if (phase === 'exhale') Animated.timing(breathAnim, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true }).start();
  }, [phase]);

  const getLabel = () => phase === 'inhale' ? 'Inhale' : phase === 'hold' ? 'Hold' : 'Exhale';

  return (
    <View style={hubStyles.gameWrapper}>
      <View style={styles.header}><TouchableOpacity onPress={onBack}><Ionicons name="arrow-back" size={24} color={colors.textSecondary}/></TouchableOpacity><Text style={styles.headerTitle}>Breather</Text></View>
      <View style={hubStyles.breatherContainer}>
        <Animated.View style={[hubStyles.breathCircle, { transform: [{ scale: breathAnim }], backgroundColor: colors.primary + '20', borderColor: colors.primary }]} />
        <Text style={[hubStyles.breathPhase, { color: colors.primary }]}>{getLabel()}</Text>
        <Text style={hubStyles.breathSeconds}>{seconds}</Text>
        <TouchableOpacity style={hubStyles.zenDoneBtn} onPress={() => { addReward(10, 5); onBack(); }}><Text style={hubStyles.zenDoneText}>Collect 10 Pts (+5 XP)</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const MATCH_ICONS = ['shield', 'flash', 'flask', 'heart', 'ribbon', 'trophy', 'diamond', 'skull'];
function DopamineMatch({ onBack, colors, tasks }) {
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [solved, setSolved] = useState([]);
  const [moves, setMoves] = useState(0);
  const [bestMoves, setBestMoves] = useState(0);
  const [showReward, setShowReward] = useState(false);
  const { addReward } = useEconomy();

  useEffect(() => {
    AsyncStorage.getItem('@ADHD_match_best').then(val => {
      if (val) setBestMoves(parseInt(val));
    });
  }, []);

  useEffect(() => {
    const pending = tasks.filter(t => t.status === 'pending');
    let pool = pending.map(t => t.title);
    
    // Shuffle pool and take 8
    let selected = shuffle(pool).slice(0, 8);
    
    // Fill if fewer than 8
    const fallbacks = ['Daily Goal', 'Drink Water', 'Stretch', 'Take a Breath', 'Deep Focus', 'Productivity', 'Brain Reset', 'ADHD Win'];
    let fallbackIdx = 0;
    while (selected.length < 8) {
      const fb = fallbacks[fallbackIdx % fallbacks.length];
      if (!selected.includes(fb)) selected.push(fb);
      fallbackIdx++;
    }

    const doubled = [...selected, ...selected].sort(() => Math.random() - 0.5).map((content, i) => ({ id: i, content }));
    setCards(doubled);
  }, []);

  const handleFlip = (idx) => {
    if (flipped.length === 2 || solved.includes(idx) || flipped.includes(idx)) return;
    const newFlipped = [...flipped, idx];
    setFlipped(newFlipped);
    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      if (cards[newFlipped[0]].content === cards[newFlipped[1]].content) { setSolved([...solved, ...newFlipped]); setFlipped([]); }
      else setTimeout(() => setFlipped([]), 800);
    }
  };

  useEffect(() => {
    if (solved.length === cards.length && cards.length > 0) {
      if (bestMoves === 0 || moves < bestMoves) {
        AsyncStorage.setItem('@ADHD_match_best', moves.toString());
        setBestMoves(moves);
        setShowReward(true);
      } else {
        Alert.alert('Perfect Match!', `You matched all tasks in ${moves} moves! (+10 XP, +25 Pts)`, [{ text: 'Great!', onPress: () => { addReward(25, 10); onBack(); } }]);
      }
    }
  }, [solved]);

  const handleRewardClaim = (pts, xp) => {
    addReward(pts, xp);
    setShowReward(false);
    onBack();
  };

  return (
    <View style={hubStyles.gameWrapper}>
      <View style={styles.header}><TouchableOpacity onPress={onBack}><Ionicons name="arrow-back" size={24} color={colors.textSecondary}/></TouchableOpacity><Text style={styles.headerTitle}>Match</Text></View>
      <View style={hubStyles.matchGrid}>
        {cards.map((c, i) => {
          const shown = flipped.includes(i) || solved.includes(i);
          return (
            <TouchableOpacity key={i} style={[hubStyles.matchCard, shown && { backgroundColor: colors.primary }]} onPress={() => handleFlip(i)}>
              {shown ? (
                <Text style={hubStyles.matchCardText} numberOfLines={3}>{c.content}</Text>
              ) : (
                <Ionicons name="help" size={24} color="#ccc"/>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={hubStyles.matchFooter}>
        <Text style={hubStyles.matchStats}>Moves: {moves}</Text>
        <Text style={hubStyles.matchBest}>Best: {bestMoves === 0 ? '--' : bestMoves}</Text>
      </View>
      <RecordDiceModal visible={showReward} colors={colors} onReward={handleRewardClaim} />
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═════════════════════════════════════════════════════════════════════════════

export default function GamesScreen() {
  const { colors } = useTheme();
  const { tasks } = useTasks();
  const [currentGame, setCurrentGame] = useState('hub');
  const scrollRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = (event) => setShowScrollTop(event.nativeEvent.contentOffset.y > 300);

  if (currentGame === 'war') return <WarGame onBack={() => setCurrentGame('hub')} tasks={tasks} colors={colors} />;
  if (currentGame === 'breather') return <FocusBreather onBack={() => setCurrentGame('hub')} colors={colors} />;
  if (currentGame === 'match') return <DopamineMatch onBack={() => setCurrentGame('hub')} colors={colors} tasks={tasks} />;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} onScroll={handleScroll} scrollEventThrottle={16}>
        <View style={styles.header}><View style={styles.headerLeft}><Ionicons name="game-controller-outline" size={24} color={colors.primary}/><Text style={styles.headerTitle}>Games Hub</Text></View></View>
        <View style={hubStyles.hubGrid}>
          <TouchableOpacity style={hubStyles.hubCard} onPress={() => setCurrentGame('war')}>
            <View style={[hubStyles.hubIcon, { backgroundColor: '#ede9fe' }]}><Ionicons name="flash" size={24} color="#6366f1"/></View>
            <View style={hubStyles.hubInfo}><Text style={hubStyles.hubTitle}>Task War</Text><Text style={hubStyles.hubDesc}>Battle the AI with your tasks. Winner takes the cards!</Text></View>
            <Ionicons name="chevron-forward" size={18} color="#ccc"/>
          </TouchableOpacity>
          <TouchableOpacity style={hubStyles.hubCard} onPress={() => setCurrentGame('breather')}>
            <View style={[hubStyles.hubIcon, { backgroundColor: '#d1fae5' }]}><Ionicons name="leaf" size={24} color="#10b981"/></View>
            <View style={hubStyles.hubInfo}><Text style={hubStyles.hubTitle}>Focus Breather</Text><Text style={hubStyles.hubDesc}>Calm your mind before a big task with guided breathing.</Text></View>
            <Ionicons name="chevron-forward" size={18} color="#ccc"/>
          </TouchableOpacity>
          <TouchableOpacity style={hubStyles.hubCard} onPress={() => setCurrentGame('match')}>
            <View style={[hubStyles.hubIcon, { backgroundColor: '#fef3c7' }]}><Ionicons name="extension-puzzle" size={24} color="#f59e0b"/></View>
            <View style={hubStyles.hubInfo}><Text style={hubStyles.hubTitle}>Dopamine Match</Text><Text style={hubStyles.hubDesc}>Quick memory game for a mental jumpstart.</Text></View>
            <Ionicons name="chevron-forward" size={18} color="#ccc"/>
          </TouchableOpacity>
        </View>

        <View style={hubStyles.logoContainer}>
          <Image source={require('../../assets/logo.png')} style={hubStyles.footerLogo} resizeMode="contain" />
        </View>
      </ScrollView>
      {showScrollTop && <ScrollToTop scrollRef={scrollRef} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f3f4f6' },
  resetBtnText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  card: { width: CARD_W, height: CARD_H, backgroundColor: '#fff', borderRadius: 10, borderWidth: 2, padding: 6, justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  cardSmall: { width: (SCREEN_W - 80) / 4, height: ((SCREEN_W - 80) / 4) * 1.4, padding: 4 },
  cardBack: { backgroundColor: colors.primary, borderColor: '#3730a3', alignItems: 'center', justifyContent: 'center' },
  cardBackPattern: { alignItems: 'center', justifyContent: 'center' },
  cardCorner: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cardValue: { fontSize: 16, fontWeight: '800' },
  cardCenterContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  cardTitle: { fontSize: 11, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  cardStars: { fontSize: 8, textAlign: 'right' },
  emptySlot: { borderColor: '#e5e7eb', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  emptySlotText: { color: colors.textMuted, fontSize: 12 },
  setupContainer: { padding: 20, paddingTop: 8 },
  phaseTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  phaseHint: { fontSize: 13, color: colors.textMuted, marginBottom: 16 },
  setupRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  rowLabel: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  rowLabelText: { fontSize: 13, fontWeight: '700' },
  shuffleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 14, marginTop: 16, elevation: 5 },
  shuffleBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  battleContainer: { padding: 20, paddingTop: 8 },
  scoreBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f9fafb', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  scoreItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scoreLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  scoreBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  scoreBadgeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  vsText: { fontSize: 16, fontWeight: '800', color: colors.textMuted },
  warStakeBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fef2f2', borderRadius: 8, paddingVertical: 8, marginBottom: 12, borderWidth: 1, borderColor: '#fecaca' },
  warStakeText: { fontSize: 14, fontWeight: '600', color: '#ef4444' },
  battleField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  battleSide: { alignItems: 'center', gap: 8 },
  sideLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  battleCenter: { alignItems: 'center', justifyContent: 'center', width: 40 },
  warBadge: { backgroundColor: '#ef4444', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  warBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  warCardsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 },
  warCardsStack: { flexDirection: 'row', width: 40, height: 30 },
  warMiniCard: { position: 'absolute', width: 22, height: 30, backgroundColor: colors.primary, borderRadius: 4, borderWidth: 1, borderColor: '#3730a3', alignItems: 'center', justifyContent: 'center' },
  warMiddleText: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  actionArea: { alignItems: 'center', minHeight: 120 },
  warButton: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ef4444', paddingHorizontal: 40, paddingVertical: 16, borderRadius: 14, elevation: 5 },
  warButtonText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  resultActions: { alignItems: 'center', gap: 10, width: '100%' },
  resultText: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  collectBtn: { backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  collectBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  taskPrompt: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  taskCard: { backgroundColor: '#fef3c7', borderRadius: 10, padding: 14, borderWidth: 1.5, borderColor: '#fbbf24', width: '100%' },
  taskCardText: { fontSize: 16, fontWeight: '600', color: '#92400e', textAlign: 'center' },
  stealRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  doTaskBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#059669', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  doTaskBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  forfeitBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#e5e7eb' },
  forfeitBtnText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
  warAnnounce: { fontSize: 20, fontWeight: '800', color: '#ef4444' },
  winContainer: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40, gap: 12 },
  winEmoji: { fontSize: 64 },
  winTitle: { fontSize: 32, fontWeight: '800', color: colors.textPrimary },
  winSub: { fontSize: 16, color: colors.textSecondary, textAlign: 'center' },
  playAgainBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, marginTop: 16 },
  playAgainText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginTop: 16, textAlign: 'center' },
  emptySub: { fontSize: 15, color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 22 },
});

const hubStyles = StyleSheet.create({
  gameWrapper: { flex: 1 },
  hubGrid: { padding: 20, gap: 16 },
  hubCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 16, borderWidth: 1, borderColor: '#f3f4f6' },
  hubIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hubInfo: { flex: 1, gap: 2 },
  hubTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  hubDesc: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  breatherContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 100 },
  breathCircle: { width: 140, height: 140, borderRadius: 70, borderWidth: 3, position: 'absolute' },
  breathPhase: { fontSize: 24, fontWeight: '800', letterSpacing: 1, marginTop: 20 },
  breathSeconds: { fontSize: 48, fontWeight: '900', color: colors.textPrimary },
  zenDoneBtn: { position: 'absolute', bottom: 40, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  zenDoneText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  matchGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 20, gap: 10, justifyContent: 'center', marginTop: 20 },
  matchCard: { width: (SCREEN_W - 80) / 4, height: (SCREEN_W - 80) / 4, backgroundColor: '#f3f4f6', borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 4 },
  matchCardText: { fontSize: 8, fontWeight: '700', color: '#fff', textAlign: 'center' },
  matchStats: { fontSize: 16, fontWeight: '700', color: '#111827' },
  matchBest: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  matchFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 40, marginTop: 20 },
  logoContainer: { alignItems: 'center', marginTop: 40, marginBottom: 80, opacity: 1, transform: [{ translateX: -5 }, { translateY: 60 }] },
  footerLogo: { width: SCREEN_W * 0.8, height: SCREEN_W * 0.4 },
});
