-- Goals are replaced by Projects (docs/spikes/goals-to-projects.md).
-- Former goal categories become plain saving categories: money set aside.
UPDATE `budget_subcategories` SET `item_type` = 'saving', `is_recurring` = 0 WHERE `item_type` = 'goal';
