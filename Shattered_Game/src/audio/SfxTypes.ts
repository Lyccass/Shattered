export type SfxEventId =
  | 'menu_open'
  | 'menu_select'
  | 'menu_confirm'
  | 'menu_cancel'
  | 'gather_start'
  | 'gather_success'
  | 'craft_start'
  | 'craft_success'
  | 'craft_failed'
  | 'action_cancelled'
  | 'item_placed'
  | 'fire_lit'
  | 'tea_brewed'
  | 'tea_consumed'
  | 'dodge'
  | 'combat_hit'
  | 'combat_miss'
  | 'contract_accepted'
  | 'contract_completed'
  | 'xp_gain'
  | 'invalid_action'
  | 'map_transition';

export type SfxEventPayload = {
  id: SfxEventId;
};
