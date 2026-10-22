export const rulesZhTW: Readonly<Record<string, string>> = {
  'M.League': 'M.League（M 聯盟）',
  'M.League supports four players only.': 'M 聯盟僅支援四人對局。',
  'M.League allows exhaustive draws only; no abortive draws or Nagashi Mangan.':
    'M 聯盟僅採荒牌流局，不採途中流局或流局滿貫。',
  'M.League: four players, head-bump Ron, Kiriage Mangan, single special-wait Yakuman and no counted Yakuman. Final league points and penalties are not included.':
    'M 聯盟：四人制、頭跳、切上滿貫、特殊等待不計雙倍役滿，不採累計役滿。尚未計算聯盟終局積分與罰則。',
  'Independent scoring with selectable Mahjong Soul, Tenhou and Custom rules.':
    '獨立計分工具，可選擇雀魂、天鳳與自訂規則。',
  'Manual 3P/4P scoring includes standard Yaku, all standard Yakuman and special waits, first-turn claims, Pao, multiple Ron, draws and Nagashi Mangan. Rule presets control the differences; settlements update dealer, honba and match state automatically.':
    '三人／四人手動計分支援一般役種、標準役滿與特殊等待、首巡宣告、包牌、多人榮和、流局與流局滿貫。不同預設會套用各自規則，結算後自動更新莊家、本場數與對局狀態。',
  'You must declare legal timing, Tenpai, Nagashi eligibility, call order and revealed indicators. The app checks consistency and calculates settlement, but has no full wall/discard simulation. Local Yaku, chombo penalties, final Uma/Oka and rank progression are outside these presets.':
    '你須確認合法時機、聽牌、流局滿貫資格、鳴牌順序與已公開指示牌。系統會檢查矛盾並計算結算，但不會模擬完整牌山與捨牌。地方役、錯和罰則、終局順位馬／岡與段位分不包含於這些預設。',
  'Every settlement stores its rules, inputs, payments and previous/next round state. Riichi deposits fund escrow before it is awarded. Undo restores the latest event’s transfers and round progression; older edits remain blocked.':
    '每次結算會儲存規則、輸入、支付與前後場況。立直供託先支付後領取。復原會還原最後一筆紀錄的點數與進程，較早紀錄仍不可編輯。',
  'Older events cannot be edited. Undo the latest event to restore its transfers and previous round state.':
    '無法編輯較早的紀錄；可復原最後一筆紀錄，還原點數支付與原本的場況。',
  'Next round': '下一局',
  riichiDeposit: '立直供託',
  exhaustive: '荒牌流局',
  abortive: '途中流局',
  'nine-terminals': '九種九牌',
  'four-winds': '四風連打',
  'four-riichi': '四家立直',
  'four-kans': '四槓散了',
  'triple-ron': '三家榮和流局',
  'Rule preset': '規則預設',
  'Mahjong Soul': '雀魂',
  Tenhou: '天鳳',
  'Custom / house rules': '自訂／家規',
  'Compare rules and view settings': '比較規則與查看設定',
  'Special waits award double Yakuman; triple Ron wins; Pao covers only the liable Yakuman component.':
    '特殊等待可計雙倍役滿；三家榮和成立；包牌僅負擔有責任的役滿部分。',
  'Special waits award single Yakuman; triple Ron draws; Pao covers the whole combined Yakuman hand.':
    '特殊等待仍計單倍役滿；三家榮和流局；包牌負擔整副複合役滿。',
  'Start with Mahjong Soul settings and change the options below. Custom settings are saved per match.':
    '以雀魂設定為基礎，自行調整以下選項。每個對局會保存自己的設定。',
  'Tenhou ranked, open Tanyao and red fives. Special waits stay single Yakuman; triple Ron is an abortive draw.':
    '天鳳段位規則，採食斷與赤寶牌。特殊等待仍計單倍役滿，三家榮和為途中流局。',
  'Custom house rules. Review the settings before you start; they remain fixed for the match.':
    '自訂家規。請於開始前核對設定；對局開始後規則固定不變。',
  'Mahjong Soul ranked-inspired. Double Yakuman variants and triple Ron are enabled; Sanma uses Tsumo-loss.':
    '參考雀魂段位規則，採雙倍役滿與三家榮和；三人麻將採自摸損。',
  'Starting points': '起始點數',
  'Multiple Ron': '多人榮和',
  'All winners, including triple Ron': '所有和牌者（含三家榮和）',
  'Double Ron; triple Ron aborts': '可雙榮和；三家榮和流局',
  'Nearest winner only (head-bump)': '頭跳（僅最近一位和牌者）',
  'Responsibility payments': '包牌／責任支付',
  'Liable Yakuman component only': '僅有責任的役滿部分',
  'Whole combined Yakuman hand': '整副複合役滿',
  Disabled: '停用',
  'Counted limit (13+ Han)': '累計上限（13 番以上）',
  'Sanma Tsumo payment': '三人自摸支付',
  'Tsumo-loss': '自摸損',
  'North-bisection (house rule)': '北家分攤（家規）',
  'Double Yakuman for special forms': '特殊牌型計雙倍役滿',
  'Combine multiple Yakuman': '可複合多種役滿',
  'Red fives enabled': '使用赤五',
  'Allow Kokushi Ron on Ankan': '國士無雙可搶暗槓',
  'Kita replacement awards Rinshan': '拔北補牌可計嶺上開花',
  'Kiriage Mangan': '切上滿貫',
  'Open Tanyao': '食斷',
  'This match keeps its saved rule snapshot. Start a new match to use different rules.':
    '此對局使用已儲存的固定規則；如需變更，請建立新對局。',
  'Game length': '對局長度',
  'East-only game': '東風戰',
  'East and South game': '東南戰',
  'Dealer rotation, honba and match endings follow the selected rules.':
    '輪莊、本場數與對局結束依所選規則自動處理。',
  'Starting points must be an integer between 1,000 and 100,000.':
    '起始點數必須為 1,000 到 100,000 的整數。',
  'Multiple Ron winners': '多人榮和名單',
  'Verify each Ron hand, add it to this list, then review all winners together. All winners must share the same discard and round context.':
    '請依序核對每位榮和者的手牌，加入名單後一併結算。所有和牌者必須使用相同的放銃牌與場況。',
  'Add verified Ron winner': '加入已核對的榮和者',
  'Review all Ron winners': '檢視所有榮和者',
  'Original call order': '最初鳴牌順序',
  'Other-player Kans': '其他玩家槓數',
  'Hand number': '局數',
  'Enter revealed indicator tiles, including revealed Kan indicators. Declare other-player Kans separately.':
    '請輸入已公開的指示牌（含已公開的槓寶牌指示牌），並另外填寫其他玩家的槓數。',
  'Tenhou (first dealer draw)': '天和（莊家首巡）',
  'Chiihou (first non-dealer draw)': '地和（閒家首巡）',
  'Replacement draw': '補牌來源',
  'After Kan': '槓後補牌',
  'After Kita': '拔北後補牌',
  'Ron circumstance': '榮和情況',
  'Normal discard / added Kan when Chankan selected': '一般放銃／勾選搶槓時為搶加槓',
  'Robbed Ankan (select Chankan)': '搶暗槓（請勾選搶槓）',
  'Robbed Kita (no Chankan bonus)': '搶拔北（不計搶槓役）',
  'I confirm this was the first draw with no calls, Kans or Kita.':
    '我確認這是首巡摸牌，且先前無任何吃碰槓或拔北。',
  'Record draw': '記錄流局',
  'Declare the actual draw circumstances. The app calculates transfers and progression; it does not infer the wall or discard history.':
    '請據實填寫流局情況。系統會計算支付與進程，但不會推測牌山或捨牌歷史。',
  'Draw type': '流局類型',
  'Exhaustive draw': '荒牌流局',
  'Abortive draw': '途中流局',
  'Nagashi Mangan': '流局滿貫',
  'Abortive draw reason': '途中流局原因',
  'Nine terminals and honors': '九種九牌',
  'Four identical first winds': '四風連打',
  'Four Riichi declarations': '四家立直',
  'Four Kans by multiple players': '四槓散了（多人槓牌）',
  'Triple Ron abort': '三家榮和流局',
  'Nine terminals: first uninterrupted draw and at least nine distinct terminals/honors. Four winds: identical first wind discards without calls. Four Kans: multiple players, after the win opportunity passes.':
    '九種九牌：無鳴牌的首巡摸牌，且至少九種么九牌。四風連打：無鳴牌且四家首張捨牌為同一風牌。四槓散了：多人開槓，且和牌機會已結束。',
  'Tenpai players': '聽牌玩家',
  'Dealer continuation on a draw follows Tenpai, including Nagashi Mangan.':
    '流局時是否連莊依莊家聽牌狀態判斷，包含流局滿貫。',
  'Nagashi Mangan players': '流局滿貫玩家',
  'Confirm that each selected player discarded only terminals/honors and none of those discards was called. Multiple qualifying players settle against one another; Riichi escrow carries forward.':
    '請確認每位所選玩家僅捨出么九牌，且其捨牌未被鳴牌。多人同時成立時互相計算支付；立直供託留至下一局。',
  'I confirm the draw circumstances and player declarations.': '我已確認流局情況與玩家宣告。',
  'Review draw settlement': '檢視流局結算',
  'Round settlement': '本局結算',
  'Confirm round settlement': '確認本局結算',
  'Dealer repeats': '莊家連莊',
  'Dealer rotates': '輪莊',
  'Winning hand': '和牌手牌',
  'No point transfers; table escrow carries forward.': '無點數支付；場上供託保留。',
  win: '和牌',
  multipleRon: '多人榮和',
  exhaustiveDraw: '荒牌流局',
  abortiveDraw: '途中流局',
  nagashi: '流局滿貫',
  'Match ended': '對局結束',
  Bankruptcy: '擊飛',
  'Dealer finish in first place': '莊家首位結束',
  'Match complete': '對局完成',
  'Final table escrow award': '終局供託歸首位',
  'Blessing of heaven (Tenhou)': '天和',
  'Blessing of earth (Chiihou)': '地和',
  'Thirteen-sided orphans (Kokushi 13 wait)': '國士無雙十三面',
  'Single-wait concealed triplets (Suuankou tanki)': '四暗刻單騎',
  'Big four winds (Daisuushii)': '大四喜',
  'Four Kans (Suukantsu)': '四槓子',
  'Pure nine gates (Junsei chuuren)': '純正九蓮寶燈',
  'Set distinct original call-order numbers for the exposed Yakuman sets to determine responsibility.':
    '請為各明副露役滿面子設定不同的最初鳴牌順序，以判斷包牌者。',
  'Ron: half of responsibility share': '榮和：責任部分的一半',
  'Responsibility: half of Ron': '包牌：榮和的一半',
  'Responsibility payment': '責任支付',
  'Responsibility: honba': '包牌：本場點數',
  'Nagashi Mangan + honba': '流局滿貫＋本場',
  'Tenpai / Noten transfer': '聽牌／未聽支付',
  'Red fives are disabled in this rule profile.': '此規則已停用赤五。',
  'The table can contain at most four Kans; enter a valid other-player Kan count.':
    '全場最多四槓；請輸入有效的其他玩家槓數。',
  'Rinshan requires Tsumo and the declared Kan/Kita replacement draw.':
    '嶺上開花須為自摸，且符合所填寫的槓牌／拔北補牌來源。',
  'First-turn Yakuman requires an uninterrupted first draw, no calls/Kita, and no conflicting claims.':
    '首巡役滿須為無鳴牌／拔北的首巡摸牌，且不可勾選矛盾條件。',
  'Tenhou is dealer-only; Chiihou is non-dealer-only.': '天和僅限莊家，地和僅限閒家。',
  'Robbing Kita requires Ron on North; it does not award Chankan or Houtei.':
    '搶拔北須以北風榮和；不計搶槓或河底役。',
  'Robbing a Kan requires the Chankan claim and Ron.': '搶槓須勾選搶槓並選擇榮和。',
  'This profile permits robbing Ankan only for Kokushi when enabled.':
    '此規則僅在啟用時允許國士無雙搶暗槓。',
  'Dora indicator count exceeds one plus the declared table Kans.':
    '寶牌指示牌數超過一張加上所宣告的全場槓數。',
  'Enter at least one winning hand.': '請至少輸入一副和牌手牌。',
  'Winners must be distinct and exclude the discarder.': '和牌者不可重複，也不能為放銃者。',
  'All Ron winners must share the same discarder, players, rules and round context.':
    '所有榮和者須使用相同的放銃者、玩家、規則與場況。',
  'All Ron winners must win on the same discarded tile.': '所有榮和者須和同一張放銃牌。',
  'Different hands must use distinct physical tile IDs.': '不同手牌必須使用不同的實體牌識別碼。',
  'All Riichi winners must use the same table Ura indicators.':
    '所有立直和牌者須使用相同的裏寶牌指示牌。',
  'Combined winning hands and indicators exceed four physical copies of a tile.':
    '合併和牌手牌與指示牌後，同一牌種超過四張。',
  'Combined hands exceed the red/ordinary five inventory.':
    '合併手牌後，赤五或普通五的張數超過牌組限制。',
  'A winning hand could not be settled.': '有一副和牌手牌無法結算。',
  'Confirm the draw circumstances and declared Tenpai/Nagashi status.':
    '請確認流局情況與聽牌／流局滿貫宣告。',
  'Invalid draw players, dealer or honba.': '流局的玩家、莊家或本場數無效。',
  'Draw selections must identify distinct seated players.': '流局選項須指定不同的在座玩家。',
  'Select an abortive draw reason.': '請選擇途中流局原因。',
  'This abortive draw requires four players.': '此途中流局條件須為四人麻將。',
  'This profile settles triple Ron as wins, not an abortive draw.':
    '此規則將三家榮和計為和牌，不是途中流局。',
  'Select at least one eligible Nagashi Mangan player.': '請至少選擇一位符合流局滿貫的玩家。',
  'This match has ended. Undo its last event to reopen it.':
    '此對局已結束。可復原最後一筆紀錄重新開啟。',
  'Invalid round settlement.': '本局結算無效。',
  'Enter a valid dealer, round, hand number and honba.': '請輸入有效的莊家、場風、局數與本場數。',
  'Settle or remove the queued Ron winners before a single-hand settlement.':
    '請先結算或移除榮和名單，再進行單一手牌結算。',
  'Settlement saved. Dealer, round and honba have been updated.':
    '已儲存結算，並更新莊家、局數與本場數。',
  'Verify a Ron hand before adding it to the winner list.': '加入和牌名單前，請先核對榮和手牌。',
  'This winner is already queued.': '此和牌者已在名單中。',
  'Ron hand added. Select the next winner and enter their hand, or review all winners.':
    '已加入榮和手牌。可選擇下一位和牌者輸入手牌，或檢視所有和牌者。',
};
