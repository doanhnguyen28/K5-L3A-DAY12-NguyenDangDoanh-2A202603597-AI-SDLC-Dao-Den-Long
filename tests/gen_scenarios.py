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
add("08_deposit_and_light", "T2 deposit: 2 m radius, cost 10 -> lit; score 10*10 + 100 = 200", 10, sc(player=P([0, 0, 23], carried=12)),
    F({"tick": 0, "interact": True}, {"tick": 1, "interact": False}),
    [{"event": "deposit", "tick": 1, "data": {"lantern_id": "L1", "amount": 10, "deposited": 10}},
     {"event": "lantern_lit", "tick": 1, "data": {"lantern_id": "L1"}},
     {"at": 10, "path": "player.carried", "equals": 2}, {"at": 10, "path": "score", "equals": 200}])
add("09_partial_deposit", "T2 deposit: partial 3 -> +30, lantern remembers progress", 10, sc(player=P([0, 0, 23], carried=3)), F({"tick": 0, "interact": True}),
    [{"event": "deposit", "tick": 1, "data": {"lantern_id": "L1", "amount": 3, "deposited": 3}}, {"no_event": "lantern_lit"},
     {"at": 10, "path": "score", "equals": 30}, {"at": 10, "path": "lanterns.0.deposited", "equals": 3}])
add("10_interact_out_of_range", "T2 interact: 2.1 m is out of 2.0 m radius", 10, sc(player=P([0, 0, 22.9], carried=5)), F({"tick": 0, "interact": True}),
    [{"no_event": "deposit"}])
add("11_win_all_lit", "T2 win: score = 10 + 100 + 2*floor(299.98) + 50*3 = 858", 100,
    sc(player=P([0, 0, 23], carried=1), lanterns=[{"id": "L1", "deposited": 9}] + [{"id": f"L{i}", "lit": True} for i in range(2, 6)]),
    F({"tick": 0, "interact": True}),
    [{"event": "game_over", "tick": 1, "data": {"result": "won", "reason": "all_lit"}}, {"end": {"ticks": 1, "state": "won", "score": 858}}])
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
     {"at": 60, "path": "sim_tick", "equals": 10}, {"at": 60, "path": "time_left_s", "equals": 299.833}, {"at": 60, "path": "player.pos", "equals": [0, 0, 1]},
     {"at": 100, "path": "sim_tick", "equals": 40}, {"at": 100, "path": "player.pos", "equals": [0, 0, 4]}, {"end": {"ticks": 100, "state": "playing"}}], every=10)
add("40a_map_night1", "T2 map night 1: standard lanterns, 20 random motes, night_start event", 1, {}, None,
    [{"event": "night_start", "tick": 0, "data": {"night": 1}}, {"at": 0, "path": "lanterns.1.pos", "equals": [23.8, 0, 7.7]},
     {"at": 0, "path": "motes_active", "equals": 20}, {"at": 0, "path": "night", "equals": 1}, {"at": 0, "path": "time_left_s", "equals": 300}])
add("40b_map_night2", "T2 map night 2: 6 lanterns, 330 s, charm C1", 1, {}, None,
    [{"event": "night_start", "tick": 0, "data": {"night": 2}}, {"at": 0, "path": "lanterns.length", "equals": 6},
     {"at": 0, "path": "lanterns.3.pos", "equals": [70, 0, 20]}, {"at": 0, "path": "time_left_s", "equals": 330}, {"at": 0, "path": "charms.0.id", "equals": "C1"}], night=2)
add("40c_map_night3", "T2 map night 3: 7 lanterns, L1 on tier 2, 360 s, start (0,0,-30) (assumption P2-A1)", 1, {}, None,
    [{"at": 0, "path": "lanterns.length", "equals": 7}, {"at": 0, "path": "lanterns.0.pos", "equals": [0, 6, 6]},
     {"at": 0, "path": "time_left_s", "equals": 360}, {"at": 0, "path": "player.pos", "equals": [0, 0, -30]}, {"at": 0, "path": "charms.length", "equals": 2}], night=3)
add("41_mote_spawn_schedule", "T2 motes: 20 at start, +1 at ticks 240 and 480 (cap 30, empty points only)", 480, {"random_shades": False, "random_drifters": False}, None,
    [{"at": 239, "path": "motes_active", "equals": 20}, {"at": 240, "path": "motes_active", "equals": 21},
     {"at": 479, "path": "motes_active", "equals": 21}, {"at": 480, "path": "motes_active", "equals": 22}])
add("42_safe_zone_evict", "T2 safe zone: shade inside 6 m when the lantern lights is pushed to the edge (<= 30 ticks) and is harmless meanwhile", 120,
    sc(player=P([0, 0, 23], carried=10), shades=[{"pos": [0, 1, 24]}]), F({"tick": 0, "interact": True}),
    [{"event": "lantern_lit", "tick": 1}, {"no_event": "player_hit"}, {"at": 25, "path": "shades.0.pos", "equals": [0, 1, 19]}])
add("42b_safe_zone_evict_speed", "T2 safe zone: eviction 0.2 m/tick, shade at 2 m reaches 6 m at tick 20", 30,
    sc(player=P([0, 0, 23], carried=10), shades=[{"pos": [2, 1, 25], "state": "stunned", "state_ticks_left": 200}]), F({"tick": 0, "interact": True}),
    [{"at": 10, "path": "shades.0.pos", "equals": [4, 1, 25]}, {"at": 20, "path": "shades.0.pos", "equals": [6, 1, 25]}, {"at": 30, "path": "shades.0.pos", "equals": [6, 1, 25]}])
add("43_win_on_last_tick", "T2 win/lose order: lighting the last lantern on the tick time reaches 0 -> won (score 10+100+0+150=260)", 10,
    sc(time_left_s=0.016666666666666666, player=P([0, 0, 23], carried=1), lanterns=[{"id": "L1", "deposited": 9}] + [{"id": f"L{i}", "lit": True} for i in range(2, 6)]),
    F({"tick": 0, "interact": True}),
    [{"end": {"ticks": 1, "state": "won", "score": 260}}])
add("44_no_flames_beats_win", "T2 win/lose order: no flames -> lost even if all lanterns are lit", 10,
    sc(player=P([0, 0, 0], flames=0), lanterns=[{"id": f"L{i}", "lit": True} for i in range(1, 6)]), None,
    [{"event": "game_over", "tick": 1, "data": {"result": "lost", "reason": "no_flames"}}])
add("45_fall_last_flame", "T2 fall with the last flame -> lost immediately, no respawn", 200, sc(player=P([0, 0, 39.95], flames=1)), F({"tick": 0, "move": [0, 1]}),
    [{"event": "player_hit", "tick": 61, "data": {"by": "fall", "flames": 0}}, {"end": {"ticks": 61, "state": "lost"}}])
add("46_fall_ignores_invuln", "T2 fall ignores invulnerability", 100, sc(player=P([0, 0, 39.95], invuln_ticks=1000)), F({"tick": 0, "move": [0, 1]}),
    [{"event": "player_hit", "tick": 61, "data": {"by": "fall", "flames": 2}}])

for name, req, ticks, scen, inp, exp, night, every in S:
    d = {"name": name, "requirement": req, "night": night, "seed": 1, "ticks": ticks, "snapshot_every": every, "scenario": scen, "inputs": inp, "expect": exp}
    with open(os.path.join(out, name + ".json"), "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
print(len(S))
