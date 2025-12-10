// src/config/surveyConfig.ts

export type QuestionType = "text" | "textarea" | "radio";

export interface SurveyQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required?: boolean;
  options?: { value: string; label: string }[];
}

export interface SurveyStep {
  id: string;
  title: string;
  questions: SurveyQuestion[];
}

export const SURVEY_STEPS: SurveyStep[] = [
  {
    id: "basic-info",
    title: "Basic Info",
    questions: [
      { id: "q1_name", label: "Name", type: "text", required: true },
      { id: "q2_email", label: "Email", type: "text", required: true },
      {
        id: "q3_social_name",
        label: "Social Name / Stage Name",
        type: "text",
        required: true,
      },
      {
        id: "q4_country",
        label: "Country / Nationality",
        type: "text",
        required: true,
      },
      {
        id: "q5_main_language",
        label: "Main Language",
        type: "text",
        required: true,
      },
      {
        id: "q6_secondary_language",
        label: "Secondary Language",
        type: "text",
      },
    ],
  },

  {
    id: "personality-1",
    title: "Personality & Social",
    questions: [
      {
        id: "q7_at_parties",
        label: "At Parties, You Usually?",
        type: "radio",
        required: true,
        options: [
          { value: "talk_many", label: "Talk to many people" },
          { value: "quiet_few", label: "Stay quiet or talk to 1–2 friends" },
        ],
      },
      {
        id: "q8_after_talking",
        label: "After talking to people all day, you feel?",
        type: "radio",
        required: true,
        options: [
          { value: "energised", label: "More energised" },
          { value: "tired", label: "Very tired, want alone time" },
        ],
      },
      {
        id: "q9_make_friends",
        label: "You make friends",
        type: "radio",
        required: true,
        options: [
          { value: "very_fast", label: "Very fast" },
          { value: "slow_real", label: "Slowly, only real ones" },
        ],
      },
      {
        id: "q10_focus_more_on",
        label: "You focus more on?",
        type: "radio",
        required: true,
        options: [
          { value: "now", label: "What is happening now" },
          { value: "future", label: "Future dream" },
          { value: "past", label: "Live in the past" },
        ],
      },
      {
        id: "q11_like_to_talk_about",
        label: "You like to talk about?",
        type: "radio",
        required: true,
        options: [
          { value: "real_daily", label: "Real daily things" },
          { value: "imagination", label: "Imagination / “what if”" },
        ],
      },
      {
        id: "q12_first_remember",
        label: "When you remember something, you first remember?",
        type: "radio",
        required: true,
        options: [
          { value: "details", label: "Details" },
          { value: "feelings", label: "Feeling / Big Picture" },
        ],
      },
    ],
  },
  {
    id: "personality-2",
    title: "Personality & Decisions",
    questions: [
      {
        id: "q13_when_someone_cries",
        label: "When someone cries, you first?",
        type: "radio",
        required: true,
        options: [
          { value: "fix_problem", label: "Want to fix the problem" },
          { value: "hug_comfort", label: "Want to hug and comfort" },
        ],
      },
      {
        id: "q14_decisions_with",
        label: "You make decisions with?",
        type: "radio",
        required: true,
        options: [
          { value: "logic", label: "Logic" },
          { value: "feelings", label: "Feelings" },
        ],
      },
      {
        id: "q15_if_partner_wrong",
        label: "If your partner does wrong, you?",
        type: "radio",
        required: true,
        options: [
          { value: "tell_directly", label: "Tell him/her directly" },
          {
            value: "hurt_inside",
            label: "Feel hurt inside and wait till he/she realised",
          },
        ],
      },
      {
        id: "q16_daily_life_is",
        label: "Your daily life is?",
        type: "radio",
        required: true,
        options: [
          { value: "planned", label: "Planned, same routine" },
          { value: "flexible", label: "Flexible, go with flow" },
        ],
      },
      {
        id: "q17_you_like",
        label: "You like?",
        type: "radio",
        required: true,
        options: [
          { value: "clean", label: "Everything clean & organized" },
          { value: "messy", label: "A little messy okay" },
        ],
      },
      {
        id: "q18_plan_date",
        label: "When plan a date, you?",
        type: "radio",
        required: true,
        options: [
          { value: "decide_exact", label: "Decide time & place exactly" },
          { value: "let_see", label: "Just “let’s meet and see”" },
        ],
      },
    ],
  },

  {
    id: "personality-3",
    title: "Social Style & Rules",
    questions: [
      {
        id: "q19_you_are_more",
        label: "You are more?",
        type: "radio",
        required: true,
        options: [
          { value: "quiet", label: "Quiet/reserved" },
          { value: "talkative", label: "Talkative/energetic" },
        ],
      },
      {
        id: "q20_care_more_about",
        label: "You care more about?",
        type: "radio",
        required: true,
        options: [
          { value: "facts", label: "Facts & truth" },
          { value: "feelings", label: "People’s feelings" },
        ],
      },
      {
        id: "q21_weekend_prefer",
        label: "Weekend you prefer?",
        type: "radio",
        required: true,
        options: [
          { value: "stay_home", label: "Stay at home relax" },
          { value: "go_out", label: "Go out have fun" },
        ],
      },
      {
        id: "q22_rules_are",
        label: "Rules are?",
        type: "radio",
        required: true,
        options: [
          { value: "important", label: "Important to follow" },
          { value: "can_bend", label: "Can bend sometimes" },
          { value: "to_break", label: "To break" },
        ],
      },
      {
        id: "q23_my_future",
        label: "My future",
        type: "radio",
        required: true,
        options: [
          { value: "clear_plan", label: "I have clear plan" },
          { value: "see_what_happens", label: "I will see what happens" },
        ],
      },
      {
        id: "q24_compliments_make_you",
        label: "Compliments make you?",
        type: "radio",
        required: true,
        options: [
          { value: "shy", label: "Shy" },
          { value: "happy_loud", label: "Very happy and loud" },
        ],
      },
    ],
  },

  {
    id: "personality-4",
    title: "Love & Secrets",
    questions: [
      {
        id: "q25_when_friend_telling",
        label: "When a close friend trying to tell you something",
        type: "radio",
        required: true,
        options: [
          {
            value: "listen_story",
            label: "I will listen to the whole story first",
          },
          {
            value: "give_suggestions",
            label: "I will keep giving him/her suggestions",
          },
        ],
      },
      {
        id: "q26_secrets",
        label: "Secrets",
        type: "radio",
        required: true,
        options: [
          { value: "keep_inside", label: "I keep inside" },
          {
            value: "share_close",
            label: "I will share with people close to me",
          },
        ],
      },
      {
        id: "q27_love_style",
        label: "My love style?",
        type: "radio",
        required: true,
        options: [
          {
            value: "actions",
            label: "Show by actions (care, cook, etc.)",
          },
          {
            value: "sweet_words",
            label: "Say sweet words a lot",
          },
          {
            value: "keep_inside",
            label: "Keep it inside",
          },
        ],
      },
      {
        id: "q28_when_annoying",
        label: "When you find someone annoying",
        type: "radio",
        required: true,
        options: [
          {
            value: "be_straight",
            label: "Be straight and tell the person to stop",
          },
          {
            value: "stay_quiet",
            label: "You will stay quiet and not talk at all",
          },
        ],
      },
    ],
  },

  {
    id: "routine",
    title: "Daily Routine & Catchphrases",
    questions: [
      {
        id: "q29_catchphrases",
        label:
          "What's your catch phrase? (OMG, You're funny, Really?... 1–5 catchphrases)",
        type: "textarea",
        required: true,
      },
      {
        id: "q30_wakeup_time",
        label: "What time do you wake up every day?",
        type: "text",
        required: true,
      },
      {
        id: "q31_sleep_time",
        label: "What time do you sleep every day?",
        type: "text",
        required: true,
      },
      {
        id: "q32_must_do_morning",
        label: "One thing you MUST do every day when you wake up?",
        type: "textarea",
        required: true,
      },
      {
        id: "q33_must_do_night",
        label: "One thing you MUST do before you go to sleep?",
        type: "textarea",
        required: true,
      },
    ],
  },

  {
    id: "favorites-food",
    title: "Favorites – Food & Taste",
    questions: [
      {
        id: "q34_favorite_food",
        label: "My Favorite food is",
        type: "text",
        required: true,
      },
      {
        id: "q35_favorite_food_type",
        label: "My Favorite food type (Italian, Japanese, Indian...)",
        type: "text",
        required: true,
      },
      {
        id: "q36_favorite_drink",
        label: "My Favorite Drink is",
        type: "text",
      },
      {
        id: "q37_sweet_or_salty",
        label: "Sweet or Salty or Other?",
        type: "radio",
        required: true,
        options: [
          { value: "sweet", label: "Sweet" },
          { value: "salty", label: "Salty" },
          { value: "other", label: "Other" },
        ],
      },
      {
        id: "q38_favorite_snack",
        label: "My Favorite Snack is",
        type: "text",
        required: true,
      },
    ],
  },

  {
    id: "favorites-style",
    title: "Favorites – Colors & Seasons",
    questions: [
      {
        id: "q39_favorite_color",
        label: "My Favorite Color",
        type: "text",
        required: true,
      },
      {
        id: "q40_favorite_animal",
        label: "My Favorite animal",
        type: "text",
        required: true,
      },
      {
        id: "q41_favorite_season",
        label: "My Favorite season",
        type: "text",
        required: true,
      },
      {
        id: "q42_favorite_weather",
        label: "My Favorite weather",
        type: "text",
      },
      {
        id: "q43_favorite_sport",
        label: "My Favorite sport",
        type: "text",
        required: true,
      },
    ],
  },
  {
    id: "favorites-entertainment",
    title: "Favorites – Entertainment & Apps",
    questions: [
      {
        id: "q44_favorite_party_type",
        label: "My Favorite party type (Luxury, Casual, Cosplay...)",
        type: "text",
        required: true,
      },
      {
        id: "q45_favorite_movie_or_series",
        label: "My Favorite movie or series",
        type: "text",
        required: true,
      },
      {
        id: "q46_favorite_song_now",
        label: "My Favorite song right now",
        type: "text",
        required: true,
      },
      {
        id: "q47_favorite_music_type",
        label: "My Favorite music type",
        type: "text",
        required: true,
      },
      {
        id: "q48_what_do_when_bored",
        label: "What you do when bored?",
        type: "textarea",
        required: true,
      },
      {
        id: "q49_favorite_app_or_game",
        label: "My Favorite app or game right now",
        type: "text",
        required: true,
      },
      {
        id: "q50_like_shopping",
        label: "Do you like shopping?",
        type: "radio",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
          { value: "sometimes", label: "Sometimes" },
        ],
      },
      {
        id: "q51_what_do_you_shop_most",
        label: "What do you shop the most?",
        type: "text",
        required: true,
      },
    ],
  },

  {
    id: "dates-gifts",
    title: "Dates & Gifts",
    questions: [
      {
        id: "q52_favorite_with_partner",
        label: "My Favorite thing to do with my partner or loved ones",
        type: "textarea",
        required: true,
      },
      {
        id: "q53_great_date",
        label: "What does a great DATE look like to you?",
        type: "textarea",
        required: true,
      },
      {
        id: "q54_favorite_date_place",
        label: "My Favorite date place?",
        type: "text",
        required: true,
      },
      {
        id: "q55_best_gift",
        label: "What's the best gift you ever received?",
        type: "textarea",
        required: true,
      },
      {
        id: "q56_most_memorable_gift",
        label: "What's the most memorable gift you ever received?",
        type: "textarea",
        required: true,
      },
    ],
  },
  {
    id: "feelings",
    title: "Nicknames, Humor & Emotions",
    questions: [
      {
        id: "q57_call_loved_ones",
        label: "How would you call your loved ones? (babe, hubby, honey...)",
        type: "text",
        required: true,
      },
      {
        id: "q58_how_loved_ones_call_you",
        label: "How would you like your loved ones to call you?",
        type: "text",
        required: true,
      },
      {
        id: "q59_makes_you_laugh",
        label: "What makes you laugh easily?",
        type: "textarea",
        required: true,
      },
      {
        id: "q60_makes_you_angry",
        label: "What makes you angry fast?",
        type: "textarea",
        required: true,
      },
      {
        id: "q61_when_miss_someone",
        label: "When you miss someone, what do you do?",
        type: "textarea",
        required: true,
      },
      {
        id: "q62_biggest_dream",
        label: "Your biggest dream in life?",
        type: "textarea",
        required: true,
      },
    ],
  },
];
