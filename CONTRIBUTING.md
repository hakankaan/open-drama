# Contributing to Open Drama

Thanks for helping. A few rules keep the project coherent.

## Original work

Everything in this repository is written for Open Drama (`.dkk/adr/adr-0001.md`): code, CSS, prompt and skill texts, style-preset fragments, UI copy, icons and screenshots. Do not paste material from other projects. Third-party code enters only as a declared dependency under a licence compatible with ours.

## Licence of contributions

Open Drama is licensed [CC BY-NC-SA 4.0](LICENSE) (`.dkk/adr/adr-0012.md`). By submitting a contribution you state that it is your own original work and you license it under the same terms.

## Before you change behaviour

The domain model in `.dkk/domain/` and the decisions in `.dkk/adr/` are the source of truth. Check what governs the area you touch (`dkk adr decisions context.<name>`), keep the model's names in code, and update the model in the same change when behaviour changes (`dkk render` must pass).

## Checks

```bash
pnpm typecheck
pnpm lint
```

Both must be green. Verify behaviour by running the app (`pnpm dev`) and exercising what you changed.
