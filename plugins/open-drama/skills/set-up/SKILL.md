---
name: set-up
description: "First run from the assistant, without the web studio: provider, the key's path, style and language."
---

1. get_status. If a text service is ready, the story room works: say so and offer the "Create a story" skill; name
   the other missing types as what the production floor will need.
2. If text is missing, list_model_services shows what exists. The quickest path is one ModelRunner key, which
   serves every type: tell the creator to set OPEN_DRAMA_MODELRUNNER_API_KEY and restart (or to paste the key in the
   studio if they run one). Never take the key in chat.
3. Another provider: add_model_service with the type, provider, name, base URL and model ids (browse_model_catalog
   lists ModelRunner's). The result says the service has no key yet and gives the exact command that adds it,
   reading the key from the creator's terminal; have them run it, then test_model_service with the id.
4. list_style_presets; offer to create one with create_style_preset if the creator has a look in mind.
5. get_settings; set the content language with update_settings if the creator writes in another language.
6. get_status again; when the text service is ready, offer the "Create a story" skill.
