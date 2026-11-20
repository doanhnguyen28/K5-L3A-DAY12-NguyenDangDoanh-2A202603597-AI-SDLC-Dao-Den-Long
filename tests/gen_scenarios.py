import json, math, sys, os
out = sys.argv[1]
E = {"random_motes": False, "random_shades": False, "random_drifters": False, "motes": [], "shades": []}
def sc(**kw):
    d = dict(E); d.update(kw); return d
def P(pos, carried=0, flames=3, **kw):
    d = {"pos": pos, "carried": carried, "flames": flames}; d.update(kw); return d
def F(*fr):
    return {"frames": list(fr)}
S = []
def add(name, req, ticks, scen, inp, exp, night=1, every=1):
    S.append((name, req, ticks, scen, inp, exp, night, every))

add("01_move_forward", "R1 move: 6 m/s, move [0,1] cam 0 -> +Z, 60 ticks = 6 m", 60, sc(), F({"tick": 0, "move": [0, 1]}),
    [{"at": 60, "path": "player.pos", "equals": [0, 0, 6]}, {"at": 60, "path": "player.vel", "equals": [0, 0, 6]}])
add("02_move_diagonal_normalized", "R1 move: vector longer than 1 normalized", 60, sc(), F({"tick": 0, "move": [1, 1]}),
    [{"at": 60, "path": "player.pos", "equals": [4.243, 0, 4.243]}])
add("03_move_cam_yaw_90", "R1 move: cam_yaw_deg 90 rotates [0,1] to +X", 60, sc(), F({"tick": 0, "move": [0, 1], "cam_yaw_deg": 90}),
    [{"at": 60, "path": "player.pos", "equals": [6, 0, 0]}])
add("04_jump", "R1 jump 7 m/s, g 20: airborne at tick 10, lands by tick 41", 60, sc(), F({"tick": 0, "jump": True}, {"tick": 1, "jump": False}),
    [{"at": 10, "path": "player.pos.1", "gt": 0}, {"at": 10, "path": "player.grounded", "equals": False},
     {"at": 60, "path": "player.pos.1", "equals": 0}, {"at": 60, "path": "player.grounded", "equals": True}])
add("05_fall_off_island", "T2 fall: leave r=40 at tick 1, Y<-10 at tick 61 -> -1 flame, lose all motes, wait 60, respawn (0,0,0) at tick 121 with invuln. [Phase 1 scenario 05 replaced: fall_enabled is now true]", 130,
    sc(player=P([0, 0, 39.95], carried=4)), F({"tick": 0, "move": [0, 1]}),
    [{"event": "player_hit", "tick": 61, "data": {"by": "fall", "flames": 2, "dropped": 0, "lost": 4}},
     {"at": 61, "path": "player.carried", "equals": 0}, {"at": 120, "path": "player.pos.1", "lt": -10},
     {"at": 121, "path": "player.pos", "equals": [0, 0, 0]}, {"at": 121, "path": "player.invuln", "equals": True},
     {"at": 122, "path": "player.pos", "equals": [0, 0, 0.1]}, {"event_count": "player_hit", "equals": 1}])
add("06_pickup_radius", "T2 pickup radius 1.0: mote at 1.0 m picked, 1.1 m not; pickup gives no score", 10, sc(motes=[[0, 0, 1.0], [0, 0, 1.1]]), None,
    [{"event": "mote_picked", "tick": 1, "data": {"carried": 1}}, {"event_count": "mote_picked", "equals": 1},
     {"at": 10, "path": "motes_active", "equals": 1}, {"at": 10, "path": "score", "equals": 0}])
add("06b_pickup_height", "T2 pickup height: |foot - mote ground| <= 1.5 picked, 1.6 not", 10, sc(motes=[[0, 1.5, 0.5], [0.5, 1.6, 0]]), None,
    [{"event_count": "mote_picked", "equals": 1}, {"at": 10, "path": "motes.0.pos", "equals": [0.5, 1.6, 0]}])
add("07_carry_capacity", "R2 capacity 10: carrying 9 picks only one", 10, sc(player=P([0, 0, 0], carried=9), motes=[[0, 0, 0.5], [0, 0, 1]]), None,
    [{"at": 10, "path": "player.carried", "equals": 10}, {"at": 10, "path": "motes_active", "equals": 1}, {"event_count": "mote_picked", "equals": 1}])
add("08_deposit_and_light", "T2/T3 deposit: 2 m radius, cost 10 -> lit (relight false); score 5*10 + 100 = 150. [P3: score per mote 10 -> 5]", 10, sc(player=P([0, 0, 23], carried=12)),
    F({"tick": 0, "interact": True}, {"tick": 1, "interact": False}),
    [{"event": "deposit", "tick": 1, "data": {"lantern_id": "L1", "amount": 10, "deposited": 10}},
     {"event": "lantern_lit", "tick": 1, "data": {"lantern_id": "L1", "relight": False}},
     {"at": 10, "path": "player.carried", "equals": 2}, {"at": 10, "path": "score", "equals": 150}, {"at": 1, "path": "lanterns.0.fuel", "equals": 100}])
add("09_partial_deposit", "T2/T3 deposit: partial 3 -> +15, lantern remembers progress. [P3: score per mote 10 -> 5]", 10, sc(player=P([0, 0, 23], carried=3)), F({"tick": 0, "interact": True}),
    [{"event": "deposit", "tick": 1, "data": {"lantern_id": "L1", "amount": 3, "deposited": 3}}, {"no_event": "lantern_lit"},
     {"at": 10, "path": "score", "equals": 15}, {"at": 10, "path": "lanterns.0.deposited", "equals": 3}])
add("10_interact_out_of_range", "T2 interact: 2.1 m is out of 2.0 m radius", 10, sc(player=P([0, 0, 22.9], carried=5)), F({"tick": 0, "interact": True}),
    [{"no_event": "deposit"}])
add("11_no_early_win", "T3 no early win: lighting the last lantern does not end the night (score 5 + 100 = 105). [P3 replaces Phase 2 '11_win_all_lit': all_lit no longer used]", 100,
    sc(player=P([0, 0, 23], carried=1), lanterns=[{"id": "L1", "deposited": 9}] + [{"id": f"L{i}", "lit": True} for i in range(2, 6)]),
    F({"tick": 0, "interact": True}),
    [{"event": "lantern_lit", "tick": 1, "data": {"lantern_id": "L1", "relight": False}}, {"no_event": "game_over"}, {"end": {"ticks": 100, "state": "playing", "score": 105}}])
add("12_lose_dawn", "R6 lose: time_left_s=1 -> lost/dawn at tick 60", 100, sc(time_left_s=1), None,
    [{"event": "game_over", "tick": 60, "data": {"result": "lost", "reason": "dawn"}}, {"end": {"ticks": 60, "state": "lost", "score": 0}}])
add("13_shade_hit_recoil_invuln", "T2 shade hit: -1 flame, drop floor(4/2)=2 dropped motes (ttl 8 s), recoil, invuln 90 -> hits at 1, 91, 181 -> lost/no_flames", 400,
    sc(player=P([0, 0, 0], carried=4), shades=[{"pos": [1, 0, 0]}]), None,
    [{"event": "player_hit", "tick": 1, "data": {"by": "shade", "flames": 2, "dropped": 2}},
     {"at": 1, "path": "motes_active", "equals": 2}, {"at": 1, "path": "motes.0.kind", "equals": "dropped"}, {"at": 1, "path": "motes.0.ttl_s", "equals": 8},
     {"at": 1, "path": "player.invuln", "equals": True}, {"at": 30, "path": "shades.0.state", "equals": "recoil"},
     {"event": "player_hit", "tick": 91, "data": {"by": "shade", "flames": 1, "dropped": 1}},
     {"event": "player_hit", "tick": 181, "data": {"flames": 0, "dropped": 0}},
     {"event": "game_over", "tick": 181, "data": {"result": "lost", "reason": "no_flames"}}, {"end": {"ticks": 181, "state": "lost"}}])
add("14_shade_chase_speed", "T2 shade chase 4.0 m/s: 10 m -> 6 m after 60 ticks", 60, sc(shades=[{"id": "S1", "pos": [10, 1, 0]}]), None,
    [{"at": 60, "path": "shades.0.pos", "equals": [6, 1, 0]}, {"at": 60, "path": "shades.0.state", "equals": "chase"}])
add("14b_shade_detect_giveup", "T2 shade detect 12 m / give up 18 m", 1,
    sc(shades=[{"id": "S1", "pos": [13, 1, 0]}, {"id": "S2", "pos": [0, 1, 11.5]}, {"id": "S3", "pos": [-17, 1, 0], "state": "chase"}, {"id": "S4", "pos": [0, 1, -18.5], "state": "chase"}]), None,
    [{"at": 1, "path": "shades.0.state", "equals": "wander"}, {"at": 1, "path": "shades.1.state", "equals": "chase"},
     {"at": 1, "path": "shades.2.state", "equals": "chase"}, {"at": 1, "path": "shades.3.state", "equals": "wander"}])
add("14c_shade_speed_night3", "T2 night 3 shade speed 4.5 m/s: 10 m -> 5.5 m after 60 ticks", 60,
    sc(player=P([0, 0, -30]), shades=[{"id": "S1", "pos": [10, 1, -30]}], wind_enabled=False), None,
    [{"at": 60, "path": "shades.0.pos", "equals": [5.5, 1, -30]}], night=3)
add("15_pulse_stun_push", "T2 pulse: cost 3, 3D dist from foot+0.8 <= 5, stun 120 ticks, push 4 m over 15 ticks, +5", 200,
    sc(player=P([0, 0, 0], carried=4), shades=[{"pos": [3, 1, 0]}]), F({"tick": 0, "pulse": True}, {"tick": 1, "pulse": False}),
    [{"event": "pulse", "tick": 1, "data": {"stunned_ids": ["S1"]}}, {"at": 1, "path": "player.carried", "equals": 1},
     {"at": 1, "path": "score", "equals": 5}, {"at": 1, "path": "player.pulse_cd_s", "equals": 3},
     {"at": 1, "path": "shades.0.pos.0", "between": [3.26, 3.27]}, {"at": 15, "path": "shades.0.pos", "equals": [7, 1, 0]},
     {"at": 120, "path": "shades.0.state", "equals": "stunned"}, {"at": 120, "path": "shades.0.pos", "equals": [7, 1, 0]},
     {"at": 121, "path": "shades.0.state", "equals": "chase"}, {"at": 121, "path": "shades.0.pos.0", "lt": 7}])
add("16_pulse_needs_3", "T2 pulse: carrying 2 (< 3) -> no pulse", 10, sc(player=P([0, 0, 0], carried=2), shades=[{"pos": [3, 1, 0]}]), F({"tick": 0, "pulse": True}),
    [{"no_event": "pulse"}, {"at": 1, "path": "player.carried", "equals": 2}])
add("17_pulse_radius_3d", "T2 pulse targets by 3D distance <= 5: S1 at 5.1 m no, S2 at 4.9 m yes, S3 high above no", 10,
    sc(player=P([0, 0, 0], carried=3), shades=[{"pos": [5.1, 0.8, 0]}, {"pos": [0, 0.8, -4.9]}, {"pos": [0, 4.9, 3]}]), F({"tick": 0, "pulse": True}),
    [{"event": "pulse", "tick": 1, "data": {"stunned_ids": ["S2"]}}, {"at": 1, "path": "score", "equals": 5}, {"at": 1, "path": "player.carried", "equals": 0}])
add("18_pulse_cooldown", "T2 pulse cooldown 3 s: press at tick 100 ignored, press at 180 fires at 181", 200, sc(player=P([0, 0, 0], carried=9)),
    F({"tick": 0, "pulse": True}, {"tick": 1, "pulse": False}, {"tick": 100, "pulse": True}, {"tick": 101, "pulse": False}, {"tick": 180, "pulse": True}),
    [{"event_count": "pulse", "equals": 2}, {"event": "pulse", "tick": 1}, {"event": "pulse", "tick": 181}, {"at": 200, "path": "player.carried", "equals": 3}])
add("19_safe_radius_lit_lantern", "T2 safe zone 6 m: chasing shade stops 6 m from lit L1 (z=19); player beside lantern is safe", 600,
    sc(player=P([0, 0, 24]), lanterns=[{"id": "L1", "lit": True}], shades=[{"pos": [0, 1, 15]}]), None,
    [{"no_event": "player_hit"}, {"at": 600, "path": "shades.0.pos", "equals": [0, 1, 19]}])
add("20_unlit_lantern_not_safe", "T2 safe zone only for lit lanterns (control for 19)", 600, sc(player=P([0, 0, 24]), shades=[{"pos": [0, 1, 15]}]), None,
    [{"event": "player_hit"}])
add("21_setup_no_score", "Contract: scenario lit:true gives no score/event; deposited = cost 10", 10, sc(lanterns=[{"id": "L1", "lit": True}]), None,
    [{"at": 0, "path": "score", "equals": 0}, {"at": 0, "path": "lanterns.0.deposited", "equals": 10}, {"no_event": "lantern_lit"}])
add("22_shade_ids", "Contract: unnamed scenario shades get ids avoiding given ids", 1,
    sc(shades=[{"pos": [30, 1, 0]}, {"id": "S1", "pos": [-30, 1, 0]}, {"pos": [0, 1, 30]}]), None,
    [{"at": 0, "path": "shades.0.id", "equals": "S2"}, {"at": 0, "path": "shades.1.id", "equals": "S1"}, {"at": 0, "path": "shades.2.id", "equals": "S3"}])
add("23_shade_spawn_night1", "T2 spawn night 1: 2 shades at tick 300 (spawning 60 ticks), then 1 every 480 (tick 780). [Phase 1 scenario 23 replaced: old schedule was 30 s]", 800,
    sc(random_shades=True), None,
    [{"event": "shade_spawned", "tick": 300, "data": {"id": "S1"}}, {"event": "shade_spawned", "tick": 300, "data": {"id": "S2"}},
     {"event": "shade_spawned", "tick": 780, "data": {"id": "S3"}}, {"event_count": "shade_spawned", "equals": 3},
     {"at": 300, "path": "shades.0.state", "equals": "spawning"}, {"at": 359, "path": "shades.0.state", "equals": "spawning"},
     {"at": 361, "path": "shades.0.state", "in": ["wander", "chase"]}])
add("23b_shade_spawn_night2", "T2 spawn night 2 every 7 s: ticks 300 (x2), 720", 730, sc(random_shades=True), None,
    [{"event": "shade_spawned", "tick": 720, "data": {"id": "S3"}}, {"event_count": "shade_spawned", "equals": 3}], night=2)
add("23c_shade_spawn_night3", "T2 spawn night 3 every 6 s: ticks 300 (x2), 660", 670, sc(random_shades=True, player=P([0, 0, -30]), wind_enabled=False), None,
    [{"event": "shade_spawned", "tick": 660, "data": {"id": "S3"}}, {"event_count": "shade_spawned", "equals": 3}], night=3)
add("24_dash", "T2 dash 14 m/s x 12 ticks (2.8 m) + 48 ticks walk (4.8 m) = 7.6 m; cooldown 1.5 s blocks re-dash at tick 51", 60, sc(),
    F({"tick": 0, "move": [0, 1], "dash": True}, {"tick": 1, "dash": False}, {"tick": 50, "dash": True}),
    [{"event": "dash", "tick": 1}, {"event_count": "dash", "equals": 1}, {"at": 1, "path": "player.dash_cd_s", "equals": 1.5},
     {"at": 5, "path": "player.vel", "equals": [0, 0, 14]}, {"at": 60, "path": "player.pos", "equals": [0, 0, 7.6]}])
add("25_dash_facing", "T2 dash when idle uses facing: walk +X 10 ticks (1 m), stop, dash -> x = 3.8", 40, sc(),
    F({"tick": 0, "move": [1, 0]}, {"tick": 10, "move": [0, 0], "dash": True}),
    [{"at": 40, "path": "player.pos", "equals": [3.8, 0, 0]}])
add("26_dash_in_air_keeps_height", "T2 dash in air keeps height: y(10)=0.861 held during dash ticks 11-22", 30, sc(),
    F({"tick": 0, "jump": True}, {"tick": 1, "jump": False}, {"tick": 10, "dash": True}),
    [{"at": 10, "path": "player.pos.1", "equals": 0.861}, {"at": 11, "path": "player.pos.1", "equals": 0.861}, {"at": 22, "path": "player.pos.1", "equals": 0.861},
     {"at": 23, "path": "player.pos.1", "gt": 0.861}, {"at": 15, "path": "player.vel", "equals": [0, 0, 14]}])
add("27_charm_speed", "T3 charm: run speed 7.2 m/s while active", 60, sc(player=P([0, 0, 0], charm_ticks=600)), F({"tick": 0, "move": [0, 1]}),
    [{"at": 60, "path": "player.pos", "equals": [0, 0, 7.2]}, {"at": 60, "path": "player.charm_s", "equals": 9}])
add("28_charm_dash_no_cooldown", "T3 charm: dash has no cooldown but a press during a dash is ignored -> dashes at ticks 1 and 21 only", 40,
    sc(player=P([0, 0, 0], charm_ticks=600)),
    F({"tick": 0, "dash": True}, {"tick": 1, "dash": False}, {"tick": 5, "dash": True}, {"tick": 6, "dash": False}, {"tick": 20, "dash": True}),
    [{"event_count": "dash", "equals": 2}, {"event": "dash", "tick": 1}, {"event": "dash", "tick": 21}])
add("29_charm_pickup_respawn", "T3 charm C1 at (35,0,0) on night 2: picked at tick 1 (600 ticks), respawns after 2700 ticks (tick 2701)", 2701,
    sc(player=P([34, 0, 0])), F({"tick": 1, "move": [-1, 0]}, {"tick": 11, "move": [0, 0]}),
    [{"event": "charm_picked", "tick": 1, "data": {"charm_id": "C1", "charm_ticks": 600}}, {"at": 37, "path": "charms.0.available", "equals": False},
     {"at": 37, "path": "player.charm_s", "gt": 9}, {"at": 2664, "path": "charms.0.available", "equals": False}, {"at": 2701, "path": "charms.0.available", "equals": True}],
    night=2, every=37)
add("30_drifter_steal", "T3 drifter: carried 6 >= 5 within 15 m -> chase 7 m/s, touch <= 1.2 at tick 16, steals 3, flees 240 ticks, removed at tick 256", 300,
    sc(player=P([0, 0, 0], carried=6), drifters=[{"pos": [3, 1, 0]}]), None,
    [{"event": "drifter_steal", "tick": 16, "data": {"drifter_id": "D1", "amount": 3, "carried": 3}},
     {"at": 1, "path": "drifters.0.state", "equals": "chase"}, {"at": 16, "path": "drifters.0.state", "equals": "flee"},
     {"at": 255, "path": "drifters.0.state", "equals": "flee"}, {"at": 256, "path": "drifters.0.state", "equals": "removed"},
     {"at": 256, "path": "drifters.0.stolen", "equals": 3}, {"event_count": "drifter_steal", "equals": 1}, {"at": 300, "path": "player.flames", "equals": 3}], night=2)
add("31_drifter_pulse_drop", "T3 drifter: pulse on a fleeing drifter with loot drops 3 dropped motes (ttl 480) and it vanishes after 120 ticks", 481,
    sc(player=P([0, 0, 0], carried=3), drifters=[{"pos": [4, 1, 0], "state": "flee", "stolen": 3}]), F({"tick": 0, "pulse": True}),
    [{"event": "drifter_drop", "tick": 1, "data": {"drifter_id": "D1", "amount": 3}}, {"at": 1, "path": "motes_active", "equals": 3},
     {"at": 1, "path": "motes.0.kind", "equals": "dropped"}, {"at": 1, "path": "motes.0.pos", "equals": [4, 0, 0]},
     {"at": 120, "path": "drifters.0.state", "equals": "flee"}, {"at": 121, "path": "drifters.0.state", "equals": "removed"},
     {"at": 480, "path": "motes_active", "equals": 3}, {"at": 481, "path": "motes_active", "equals": 0}], night=2)
add("32_drifter_pulse_chase", "T3 drifter: pulse on a chasing drifter -> flee without stealing", 300,
    sc(player=P([0, 0, 0], carried=8), drifters=[{"pos": [4, 1, 0]}]), F({"tick": 5, "pulse": True}),
    [{"at": 5, "path": "drifters.0.state", "equals": "chase"}, {"at": 6, "path": "drifters.0.state", "equals": "flee"},
     {"at": 6, "path": "drifters.0.stolen", "equals": 0}, {"no_event": "drifter_steal"}, {"at": 300, "path": "player.carried", "equals": 5}], night=2)
add("33_drifter_idle_low_carry", "T3 drifter stays idle when carrying < 5", 60, sc(player=P([0, 0, 0], carried=4), drifters=[{"pos": [3, 1, 0]}]), None,
    [{"at": 30, "path": "drifters.0.state", "equals": "idle"}, {"no_event": "drifter_steal"}], night=2)
add("34_drifter_spawn", "T3 drifter spawns at tick 1200 on night 2", 1200, sc(random_drifters=True), None,
    [{"at": 1199, "path": "drifters.length", "equals": 0}, {"at": 1200, "path": "drifters.length", "equals": 1},
     {"at": 1200, "path": "drifters.0.id", "equals": "D1"}, {"at": 1200, "path": "drifters.0.state", "equals": "idle"}], night=2)
add("35_launch_pad_night2", "T2 map night 2: pad (20,0,18) launches vy 14, 24 m/s toward island B; move keys ignored in flight; lands on B near (51.4,0,6.3)", 105,
    sc(player=P([20, 0, 15])), F({"tick": 0, "move": [0, 1]}),
    [{"at": 30, "path": "player.grounded", "equals": False}, {"at": 105, "path": "player.grounded", "equals": True},
     {"at": 105, "path": "player.pos.0", "between": [51.3, 51.6]}, {"at": 105, "path": "player.pos.2", "between": [6.2, 6.7]}, {"no_event": "player_hit"}], night=2)
add("36_launch_pad_night3", "T2 map night 3: pad (0,3,13) launches vy 12, 8 m/s toward -Z, lands on tier 2 (Y=6)", 100,
    sc(player=P([0, 3, 15]), wind_enabled=False), F({"tick": 0, "move": [0, -1]}, {"tick": 10, "move": [0, 0]}),
    [{"at": 100, "path": "player.pos.1", "equals": 6}, {"at": 100, "path": "player.grounded", "equals": True}, {"at": 100, "path": "player.pos.2", "between": [7.3, 7.6]}], night=3)
add("37_tier_wall", "T2 map night 3: tier-1 wall at r=24 (z>0) blocks walking up", 120, sc(player=P([0, 0, 30]), wind_enabled=False), F({"tick": 0, "move": [0, -1]}),
    [{"at": 120, "path": "player.pos.2", "between": [23.99, 24.11]}, {"at": 120, "path": "player.pos.1", "equals": 0}], night=3)
a = math.radians(30)
add("37b_ramp_climb", "T2 map night 3: ramp at 30 deg climbs from r=30 (Y0) to r=24 (Y3) onto tier 1", 120,
    sc(player=P([round(30.5 * math.cos(a), 3), 0, round(30.5 * math.sin(a), 3)]), wind_enabled=False),
    F({"tick": 0, "move": [round(-math.cos(a), 4), round(-math.sin(a), 4)]}),
    [{"at": 120, "path": "player.pos.1", "equals": 3}, {"at": 120, "path": "player.grounded", "equals": True}], night=3)
add("38_wind", "T2 map night 3: gust active ticks 1800-2099, pushes player 2 m/s", 2100, sc(player=P([0, 0, -30])), None,
    [{"at": 1797, "path": "wind.active", "equals": False}, {"at": 1800, "path": "wind.active", "equals": True}, {"at": 2097, "path": "wind.active", "equals": True},
     {"at": 2100, "path": "wind.active", "equals": False}, {"at": 2100, "path": "player.pos", "ne": [0, 0, -30]}], night=3, every=3)
add("38b_wind_disabled", "Contract v1.1: wind_enabled=false disables gusts on night 3", 1800, sc(player=P([0, 0, -30]), wind_enabled=False), None,
    [{"at": 1800, "path": "wind.active", "equals": False}, {"at": 1800, "path": "player.pos", "equals": [0, 0, -30]}], night=3, every=300)
add("39_pause", "T3 pause: paused at tick 11, resumed at 71; tick advances while sim_tick, time and movement freeze", 100, sc(),
    F({"tick": 0, "move": [0, 1]}, {"tick": 10, "pause": True}, {"tick": 11, "pause": False}, {"tick": 70, "pause": True}),
    [{"event": "paused", "tick": 11}, {"event": "resumed", "tick": 71}, {"at": 60, "path": "state", "equals": "paused"},
     {"at": 60, "path": "sim_tick", "equals": 10}, {"at": 60, "path": "time_left_s", "equals": 239.833}, {"at": 60, "path": "player.pos", "equals": [0, 0, 1]},
     {"at": 100, "path": "sim_tick", "equals": 40}, {"at": 100, "path": "player.pos", "equals": [0, 0, 4]}, {"end": {"ticks": 100, "state": "playing"}}], every=10)
add("40a_map_night1", "T2/T3 map night 1: standard lanterns, 20 random motes, night_start, 240 s [P3: 300 -> 240 s], lantern fuel fields, capacity 10", 1, {}, None,
    [{"event": "night_start", "tick": 0, "data": {"night": 1}}, {"at": 0, "path": "lanterns.1.pos", "equals": [23.8, 0, 7.7]},
     {"at": 0, "path": "motes_active", "equals": 20}, {"at": 0, "path": "night", "equals": 1}, {"at": 0, "path": "time_left_s", "equals": 240},
     {"at": 0, "path": "lanterns.0.fuel", "equals": 0}, {"at": 0, "path": "lanterns.0.ever_lit", "equals": False}, {"at": 0, "path": "lanterns.0.relit_count", "equals": 0}, {"at": 0, "path": "player.capacity", "equals": 10}])
add("40b_map_night2", "T2/T3 map night 2: 6 lanterns, 270 s [P3: 330 -> 270], charm C1", 1, {}, None,
    [{"event": "night_start", "tick": 0, "data": {"night": 2}}, {"at": 0, "path": "lanterns.length", "equals": 6},
     {"at": 0, "path": "lanterns.3.pos", "equals": [70, 0, 20]}, {"at": 0, "path": "time_left_s", "equals": 270}, {"at": 0, "path": "charms.0.id", "equals": "C1"}], night=2)
add("40c_map_night3", "T2/T3 map night 3: 7 lanterns, L1 on tier 2, 300 s [P3: 360 -> 300], start (0,0,-30) (assumption P2-A1)", 1, {}, None,
    [{"at": 0, "path": "lanterns.length", "equals": 7}, {"at": 0, "path": "lanterns.0.pos", "equals": [0, 6, 6]},
     {"at": 0, "path": "time_left_s", "equals": 300}, {"at": 0, "path": "player.pos", "equals": [0, 0, -30]}, {"at": 0, "path": "charms.length", "equals": 2}], night=3)
add("41_mote_spawn_schedule", "T2 motes: 20 at start, +1 at ticks 240 and 480 (cap 30, empty points only)", 480, {"random_shades": False, "random_drifters": False}, None,
    [{"at": 239, "path": "motes_active", "equals": 20}, {"at": 240, "path": "motes_active", "equals": 21},
     {"at": 479, "path": "motes_active", "equals": 21}, {"at": 480, "path": "motes_active", "equals": 22}])
add("42_safe_zone_evict", "T2 safe zone: shade inside 6 m when the lantern lights is pushed to the edge (<= 30 ticks) and is harmless meanwhile", 120,
    sc(player=P([0, 0, 23], carried=10), shades=[{"pos": [0, 1, 24]}]), F({"tick": 0, "interact": True}),
    [{"event": "lantern_lit", "tick": 1}, {"no_event": "player_hit"}, {"at": 25, "path": "shades.0.pos", "equals": [0, 1, 19]}])
add("42b_safe_zone_evict_speed", "T2 safe zone: eviction 0.2 m/tick, shade at 2 m reaches 6 m at tick 20", 30,
    sc(player=P([0, 0, 23], carried=10), shades=[{"pos": [2, 1, 25], "state": "stunned", "state_ticks_left": 200}]), F({"tick": 0, "interact": True}),
    [{"at": 10, "path": "shades.0.pos", "equals": [4, 1, 25]}, {"at": 20, "path": "shades.0.pos", "equals": [6, 1, 25]}, {"at": 30, "path": "shades.0.pos", "equals": [6, 1, 25]}])
add("43_light_on_dawn_tick_counts", "T3 lantern lit on the dawn tick counts: 2 lit + L3 lit at tick 1 = 3/5 -> won dawn_survived. Score 5+100 + L1,L2 (50+99) + L3 (50+100) + 150 = 703. [P3 replaces Phase 2 '43_win_on_last_tick']", 10,
    sc(time_left_s=0.016666666666666666, player=P([14.7, 0, -18.2], carried=1), lanterns=[{"id": "L1", "lit": True, "fuel": 99.5}, {"id": "L2", "lit": True, "fuel": 99.5}, {"id": "L3", "deposited": 9}]),
    F({"tick": 0, "interact": True}),
    [{"event": "game_over", "tick": 1, "data": {"result": "won", "reason": "dawn_survived"}}, {"end": {"ticks": 1, "state": "won", "score": 703}}])
add("44_no_flames_beats_win", "T2 win/lose order: no flames -> lost even if all lanterns are lit", 10,
    sc(player=P([0, 0, 0], flames=0), lanterns=[{"id": f"L{i}", "lit": True} for i in range(1, 6)]), None,
    [{"event": "game_over", "tick": 1, "data": {"result": "lost", "reason": "no_flames"}}])
add("45_fall_last_flame", "T2 fall with the last flame -> lost immediately, no respawn", 200, sc(player=P([0, 0, 39.95], flames=1)), F({"tick": 0, "move": [0, 1]}),
    [{"event": "player_hit", "tick": 61, "data": {"by": "fall", "flames": 0}}, {"end": {"ticks": 61, "state": "lost"}}])
add("46_fall_ignores_invuln", "T2 fall ignores invulnerability", 100, sc(player=P([0, 0, 39.95], invuln_ticks=1000)), F({"tick": 0, "move": [0, 1]}),
    [{"event": "player_hit", "tick": 61, "data": {"by": "fall", "flames": 2}}])

add("50_fuel_decay", "T3 fuel: lit lantern loses 1 fuel/s: 100 -> 99.0 at tick 60, 90.0 at tick 600", 600, sc(lanterns=[{"id": "L1", "lit": True}]), None,
    [{"at": 0, "path": "lanterns.0.fuel", "equals": 100}, {"at": 60, "path": "lanterns.0.fuel", "equals": 99}, {"at": 600, "path": "lanterns.0.fuel", "equals": 90}], every=60)
add("51_lantern_out", "T3 fuel 1 -> 0 at tick 60: lantern_out, lit false, deposited 0, fuel 0, ever_lit stays true", 70, sc(lanterns=[{"id": "L1", "lit": True, "fuel": 1}]), None,
    [{"event": "lantern_out", "tick": 60, "data": {"lantern_id": "L1"}}, {"at": 59, "path": "lanterns.0.lit", "equals": True}, {"at": 60, "path": "lanterns.0.lit", "equals": False},
     {"at": 60, "path": "lanterns.0.deposited", "equals": 0}, {"at": 60, "path": "lanterns.0.fuel", "equals": 0}, {"at": 60, "path": "lanterns.0.ever_lit", "equals": True}])
add("52_refuel_full", "T3 refuel: fuel 55 -> 54.983 after decay; used = min(10, ceil(45.02/10)=5) = 5 -> fuel 100, +25", 5,
    sc(player=P([0, 0, 23], carried=10), lanterns=[{"id": "L1", "lit": True, "fuel": 55}]), F({"tick": 0, "interact": True}),
    [{"event": "refuel", "tick": 1, "data": {"lantern_id": "L1", "amount": 5, "fuel": 100}}, {"at": 1, "path": "player.carried", "equals": 5}, {"at": 1, "path": "score", "equals": 25}, {"no_event": "lantern_lit"}])
add("52b_refuel_partial", "T3 refuel: carrying 2 at fuel 55 -> used 2, fuel 54.983 + 20 = 74.983 -> 75.0, +10", 5,
    sc(player=P([0, 0, 23], carried=2), lanterns=[{"id": "L1", "lit": True, "fuel": 55}]), F({"tick": 0, "interact": True}),
    [{"event": "refuel", "tick": 1, "data": {"lantern_id": "L1", "amount": 2, "fuel": 75}}, {"at": 1, "path": "player.carried", "equals": 0}, {"at": 1, "path": "score", "equals": 10}])
add("53_relight_cost_5", "T3 relight: ever_lit lantern needs 5; relight true, +5*5 + 40 = 65, relit_count 1, fuel 100, capacity 12", 5,
    sc(player=P([0, 0, 23], carried=7), lanterns=[{"id": "L1", "ever_lit": True}]), F({"tick": 0, "interact": True}),
    [{"event": "deposit", "tick": 1, "data": {"lantern_id": "L1", "amount": 5, "deposited": 5}}, {"event": "lantern_lit", "tick": 1, "data": {"lantern_id": "L1", "relight": True}},
     {"at": 1, "path": "score", "equals": 65}, {"at": 1, "path": "lanterns.0.relit_count", "equals": 1}, {"at": 1, "path": "lanterns.0.fuel", "equals": 100},
     {"at": 1, "path": "player.carried", "equals": 2}, {"at": 1, "path": "player.capacity", "equals": 12}])
add("54_capacity_growth", "T3 capacity = min(20, 10 + 2*successful_lights): 5 lights -> 20; carrying 19 picks one of two motes", 5,
    sc(player=P([0, 0, 0], carried=19, successful_lights=5), motes=[[0, 0, 0.5], [0, 0, 0.8]]), None,
    [{"at": 0, "path": "player.capacity", "equals": 20}, {"at": 5, "path": "player.carried", "equals": 20}, {"at": 5, "path": "motes_active", "equals": 1}])
add("54b_capacity_cap", "T3 capacity capped at 20 (successful_lights 7 -> 20, not 24)", 1, sc(player=P([0, 0, 0], successful_lights=7)), None,
    [{"at": 0, "path": "player.capacity", "equals": 20}])
add("55_safe_zone_until_30", "T3 safe zone kept while fuel >= 30 (fuel 40 reaches 30.0 at tick 600: shade still blocked at z=19), lost below 30 -> shade reaches player", 800,
    sc(player=P([0, 0, 24]), lanterns=[{"id": "L1", "lit": True, "fuel": 40}], shades=[{"id": "S1", "pos": [0, 1, 15], "state": "chase"}]), None,
    [{"at": 600, "path": "lanterns.0.fuel", "equals": 30}, {"at": 600, "path": "shades.0.pos", "equals": [0, 1, 19]}, {"at": 600, "path": "player.flames", "equals": 3},
     {"at": 800, "path": "player.flames", "lt": 3}], every=100)
add("56_drain", "T3 drain: wander shade 1.5 m from weak L1 (fuel 20) -> drain at tick 1; from tick 2 fuel -6/60 per tick; fuel_drain at tick 61 (fuel 14.0); out at tick 201", 210,
    sc(player=P([0, 0, -20]), lanterns=[{"id": "L1", "lit": True, "fuel": 20}], shades=[{"id": "S1", "pos": [0, 1, 23.5]}]), None,
    [{"at": 1, "path": "shades.0.state", "equals": "drain"}, {"at": 100, "path": "shades.0.pos", "equals": [0, 1, 23.5]},
     {"event": "fuel_drain", "tick": 61, "data": {"lantern_id": "L1", "shade_id": "S1", "fuel": 14}},
     {"event": "lantern_out", "tick": 201, "data": {"lantern_id": "L1"}}, {"at": 200, "path": "lanterns.0.lit", "equals": True}, {"at": 201, "path": "shades.0.state", "equals": "wander"}])
add("56b_drain_stacks", "T3 drain stacks: two shades -> fuel -11/60 per tick from tick 2 -> out at tick 110", 120,
    sc(player=P([0, 0, -20]), lanterns=[{"id": "L1", "lit": True, "fuel": 20}], shades=[{"id": "S1", "pos": [0, 1, 23.5]}, {"id": "S2", "pos": [0.5, 1, 23.6]}]), None,
    [{"event": "lantern_out", "tick": 110, "data": {"lantern_id": "L1"}}, {"at": 109, "path": "lanterns.0.lit", "equals": True}])
add("57_drain_to_chase", "T3 drain -> chase when Mây comes within 6 m (player walks in from 13.5 m; at 6.0 m at tick ~75)", 90,
    sc(player=P([0, 0, 37]), lanterns=[{"id": "L1", "lit": True, "fuel": 20}], shades=[{"id": "S1", "pos": [0, 1, 23.5]}]), F({"tick": 0, "move": [0, -1]}),
    [{"at": 1, "path": "shades.0.state", "equals": "drain"}, {"at": 70, "path": "shades.0.state", "equals": "drain"}, {"at": 80, "path": "shades.0.state", "equals": "chase"}])
add("58_pulse_drainer_bonus", "T3 score: pulse on a draining shade = +15 total", 5,
    sc(player=P([0, 0, 27], carried=3), lanterns=[{"id": "L1", "lit": True, "fuel": 20}], shades=[{"id": "S1", "pos": [0, 1, 23.5], "state": "drain", "target_lantern_id": "L1"}]),
    F({"tick": 0, "pulse": True}),
    [{"event": "pulse", "tick": 1, "data": {"stunned_ids": ["S1"]}}, {"at": 1, "path": "score", "equals": 15}, {"at": 1, "path": "shades.0.state", "equals": "stunned"}])
add("59_refuel_evicts_drainer", "T3 refuel to >= 30 (20 -> 49.9) pushes the drainer out to the 6 m edge within 30 ticks, harmless meanwhile", 60,
    sc(player=P([0, 0, 26.5], carried=3), lanterns=[{"id": "L1", "lit": True, "fuel": 20}], shades=[{"id": "S1", "pos": [0, 1, 23.5], "state": "drain", "target_lantern_id": "L1"}]),
    F({"tick": 0, "interact": True}),
    [{"event": "refuel", "tick": 1, "data": {"lantern_id": "L1", "amount": 3, "fuel": 49.9}}, {"no_event": "player_hit"}, {"at": 30, "path": "shades.0.pos", "equals": [0, 1, 19]}, {"at": 60, "path": "shades.0.pos", "equals": [0, 1, 19]}])
add("60_dawn_survived", "T3 win: alive at dawn with 3/5 lit -> dawn_survived; score 3*(50 + floor(99.0)) + 3*50 = 597", 100,
    sc(time_left_s=1, lanterns=[{"id": f"L{i}", "lit": True} for i in range(1, 4)]), None,
    [{"event": "game_over", "tick": 60, "data": {"result": "won", "reason": "dawn_survived"}}, {"end": {"ticks": 60, "state": "won", "score": 597}}])
add("61_dawn_below_threshold", "T3 lose: dawn with 2/5 lit (< ceil(0.6*5)=3) -> lost/dawn, no dawn bonus", 100,
    sc(time_left_s=1, lanterns=[{"id": f"L{i}", "lit": True} for i in range(1, 3)]), None,
    [{"event": "game_over", "tick": 60, "data": {"result": "lost", "reason": "dawn"}}, {"end": {"ticks": 60, "state": "lost", "score": 0}}])
add("61b_threshold_night2", "T3 win threshold night 2 = 4/6: 4 lit at dawn -> won", 100,
    sc(time_left_s=1, lanterns=[{"id": f"L{i}", "lit": True} for i in range(1, 5)]), None,
    [{"event": "game_over", "tick": 60, "data": {"result": "won", "reason": "dawn_survived"}}], night=2)
add("61c_threshold_night3", "T3 win threshold night 3 = 5/7: 4 lit at dawn -> lost", 100,
    sc(time_left_s=1, player=P([0, 0, -30]), wind_enabled=False, lanterns=[{"id": f"L{i}", "lit": True} for i in range(1, 5)]), None,
    [{"event": "game_over", "tick": 60, "data": {"result": "lost", "reason": "dawn"}}], night=3)
add("62_no_flames_on_dawn_tick", "T3 order: falling to the last flame on the dawn tick (61) -> lost no_flames even with 3/5 lit", 100,
    sc(time_left_s=1.0166666666666666, player=P([0, 0, 39.95], flames=1), lanterns=[{"id": f"L{i}", "lit": True} for i in range(1, 4)]), F({"tick": 0, "move": [0, 1]}),
    [{"event": "game_over", "tick": 61, "data": {"result": "lost", "reason": "no_flames"}}])
add("63_wander_targets_weak", "T3 wander shade goes to the nearest weak lantern (fuel < 30), not to a healthy one", 300,
    sc(player=P([0, 0, -30]), lanterns=[{"id": "L1", "lit": True, "fuel": 25}, {"id": "L2", "lit": True}], shades=[{"id": "S1", "pos": [12, 1, 17]}]), None,
    [{"at": 300, "path": "shades.0.state", "equals": "drain"}, {"at": 300, "path": "lanterns.1.fuel", "equals": 95}, {"event": "fuel_drain", "data": {"lantern_id": "L1", "shade_id": "S1"}}], every=50)

for name, req, ticks, scen, inp, exp, night, every in S:
    d = {"name": name, "requirement": req, "night": night, "seed": 1, "ticks": ticks, "snapshot_every": every, "scenario": scen, "inputs": inp, "expect": exp}
    with open(os.path.join(out, name + ".json"), "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
print(len(S))
