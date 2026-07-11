# Bogyoku strategy

棒玉は、玉を初期位置付近に固定する「居玉」とは異なり、玉自身を飛車先へ運ぶ攻撃的な実験戦法です。本実装では、先手は `5九→4八→3八→2七`、後手は左右反転した `5一→6二→7二→8三` で、飛車の前へ最短で進む基本図を目標にします。5八・5二は経由しません。相手の7四歩など、特定の応手は成立条件にしません。

基本図へ到達するまでは玉の進出を優先候補として別探索します。予定手には通常候補より広い専用の評価損上限を使い、多少強引でも基本図を目指します。ただし、被詰みになる手は採用しません。基本図到達後の `2五歩→2六玉`（後手は `8五歩→8四玉`）は強制手やランダム分岐にせず、通常の評価損上限内に残る場合だけ探索候補へ加えます。危険なら基本図に留まり、通常の局面判断を続けます。各棒玉AIはこれとは独立して、新局ごとに10%の確率で飛車を横へ振る候補を優先します。

## Processing

1. `shogiops` produces legal moves.
2. The position-aware state machine opens the rook pawn once and transfers the king onto the rook file.
3. State candidates and feature scoring rank legal moves; no fixed opponent sequence is required.
4. Candidate moves are passed to YaneuraOu with USI `searchmoves` and MultiPV.
5. Forced-mate losses, empty lines, and moves exceeding either the normal or planned-move centipawn-loss limit are rejected. Optional king advances beyond the base square use the normal limit.
6. The chosen move and score decomposition are shown in diagnostics.

## Features and profiles

The deterministic feature schema is `kingAdvance`, `rightPressure`, `rookSupport`, `silverAdvance`, and `tempo`. The UI provides practical, forced-style, and win-rate-oriented profiles plus a 0–100 intensity control. Profiles define an opening ply limit, tactical-loss limit, and feature weights; after the opening, or during check/large disadvantage, normal safety behavior takes priority.

## Safety constraints

- Only the rules layer creates legal moves.
- Mate and the profile-specific planned-move loss ceiling override style preference.
- Check or a severe evaluation enters emergency escape.
- State and scoring outputs are reproducible and covered by unit fixtures.
- Tuning changes are local and do not transmit positions or results externally.
