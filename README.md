# ⊢ Turnstile

A puzzle game where you prove theorems by applying the rules of natural deduction. No math background required — just careful thinking. Each level is a sequent: you have assumptions on the left, a goal on the right, and a toolbox of inference rules. Select a rule, provide its inputs, derive new facts, and build your way to the goal.

**[Play it here](https://joaquincampo.github.io/turnstile/)**

## How it works

You start with assumptions (or nothing at all) and a goal proposition to prove. On each turn you pick an inference rule — maybe *modus ponens* to follow an implication, or *∧-introduction* to combine two facts. The rule transforms what you know, adding a new line to your proof. Some rules open sub-proofs: temporary worlds where you assume something new and see what follows. Close the sub-proof and the assumption becomes an implication.

The proof is complete when the goal appears as a derived line in the main scope.

## Worlds

The game is divided into five worlds, each introducing a new connective and the rules that govern it.

| | World | Connective | Idea |
|---|---|---|---|
| 1 | **The Arrow** | → | Implication — assume and derive |
| 2 | **The Wedge** | ∧ | Conjunction — combine and separate |
| 3 | **The Vee** | ∨ | Disjunction — consider every case |
| 4 | **The Contradiction** | ¬ | Negation — reason by absurdity |
| 5 | **Classical Reasoning** | ¬¬ | Double negation elimination — what must be, is |

The final level asks you to prove the law of excluded middle (P ∨ ¬P) from scratch. Good luck.

## Rules of inference

| Symbol | Rule | Description |
|---|---|---|
| →I | Implication Introduction | Assume A; if you derive B, conclude A → B |
| →E | Modus Ponens | From A and A → B, derive B |
| ∧I | And Introduction | From A and B, derive A ∧ B |
| ∧Eₗ | And Elimination (Left) | From A ∧ B, derive A |
| ∧Eᵣ | And Elimination (Right) | From A ∧ B, derive B |
| ∨Iₗ | Or Introduction (Left) | From A, derive A ∨ B |
| ∨Iᵣ | Or Introduction (Right) | From B, derive A ∨ B |
| ∨E | Or Elimination | From A ∨ B, if A → C and B → C, derive C |
| ¬I | Negation Introduction | Assume A; if you derive ⊥, conclude ¬A |
| ¬E | Negation Elimination | From A and ¬A, derive ⊥ |
| ⊥E | Explosion | From ⊥, derive anything |
| ¬¬E | Double Negation Elim. | From ¬¬A, derive A |
| Reit | Reiteration | Copy an accessible line into the current scope |

## Tech

Vanilla JavaScript with ES modules. No build step, no dependencies, no framework. Just open `index.html`.

## Credits

Built by Claude in [Claude Corner](https://github.com/JoaquinCampo/claude-corner).
