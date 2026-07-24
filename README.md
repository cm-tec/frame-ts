# Truss

An interactive, browser-based tool for the analysis of **plane (2D) frame and truss structures**.
You define a structure in a table-driven editor and immediately see its behaviour: deformed
shapes, internal force diagrams, free-vibration animations, eigenmodes and — for insufficiently
supported systems — the kinematic mechanisms themselves.

Despite the name, the tool is not restricted to trusses: the underlying element is a full Euler–Bernoulli beam element with axial, bending and rotational degrees of freedom.
Truss members are a special case obtained through moment releases.

The app is intended as a **teaching and intuition-building companion** to courses in structural
mechanics and structural dynamics. Everything runs client-side in the browser — no installation,
no server, no data leaves the machine.

---

## Two analysis modes

The mode is selected in the header (in *Edit* mode) and changes both the available inputs and the
mechanical model:

| | **Static** | **Dynamic** |
|---|---|---|
| Element | Beam element, moment-rigid at both ends unless a hinge is defined | Pin-jointed truss member (moment released at both ends) |
| Nodal DOFs | `u`, `v`, `θ` | `u`, `v` (rotations restrained) |
| Inputs | Nodal loads, element loads, hinges, supports incl. rotational restraint | Nodal masses, axial dampers, initial conditions |
| Results | Deformed shape, `N` / `Q` / `M` diagrams, nodal displacements, support reactions | Animated time response, displacement & velocity time histories, eigenfrequencies, damping ratios, animated eigenmodes |

Rotational degrees of freedom and loading in Dynamic mode are planned; the data model and solver
are already laid out for them.

---

## Theory and methods

The implementation follows the classical **displacement (direct stiffness) method** for plane frames.

### Discretisation

- Global coordinates: `x` horizontal (positive to the right), `z` vertical (positive upwards).
- Every node carries **three degrees of freedom**: horizontal displacement `u`, vertical
  displacement `v`, and rotation `θ` (counter-clockwise, in radians).
- Every node may additionally be given a **nodal rotation angle**, which rotates its local
  coordinate system. This allows inclined supports and skewed member connections.
- Supports are imposed by restraining individual DOFs; the global system is partitioned into
  free and restrained blocks, `K₁₁`, `K₁₂`, `K₂₂`.

### Element formulation

Each element is a two-node **Euler–Bernoulli beam element** with axial stiffness `EA` and bending
stiffness `EI`, giving the standard 6×6 local stiffness matrix in the DOF order
`[uᵢ, vᵢ, θᵢ, uⱼ, vⱼ, θⱼ]`. In the terminology of the German lecture notes this is
*Grundelement 1* (clamped–clamped). Element matrices are rotated into global coordinates with a
transformation matrix built per element end, so that nodal rotations are respected, and then
expanded and added into the global matrices.

### Hinges and releases

Hinges are defined per element end and may release the normal force, the shear force and/or the
bending moment. A release is realised by **static condensation** of the released local DOFs from
the element matrix,

```
K_condensed = K_rr − K_rc · K_cc⁻¹ · K_cr
```

after which the matrix is re-expanded to 6×6 so it fits the standard assembly. Fixed-end forces
from element loads are condensed consistently for moment releases. An element with all DOFs
released at one end transmits nothing and contributes a zero matrix.

A **pure truss** is generated automatically by releasing the moment at both ends of every member
and restraining all nodal rotations — this is exactly what the Dynamic mode uses.

### Loads

- **Nodal loads:** magnitude and direction angle `α` (0° = downwards, 90° = to the right).
- **Element loads:** trapezoidal distributed load with the ordinate `qᵢ` at the start node and
  `qⱼ` at the end node, plus a direction angle relative to the member normal (0° = perpendicular
  to the member axis, 90° = along the axis). They are converted into **consistent fixed-end
  forces**,

  ```
  Vᵢ = L/20 · (7qᵢ + 3qⱼ)      Mᵢ =  L²/60 · (3qᵢ + 2qⱼ)
  Vⱼ = L/20 · (3qᵢ + 7qⱼ)      Mⱼ = −L²/60 · (2qᵢ + 3qⱼ)
  ```

  with the axial share distributed as `L/6 · (2qᵢ + qⱼ)` and `L/6 · (qᵢ + 2qⱼ)`.

### Static analysis

The free-DOF displacements follow from an LU solution of `K₁₁ · w₁ = f₁`; the support reactions
are recovered as `r₂ = K₁₂ · w₁`.

### Deformed shape and internal forces

Deformations are not drawn as straight lines between displaced nodes. Along each member the
displacement field is evaluated as a **cubic Hermite interpolation of the nodal DOFs plus the
analytical particular solution of the distributed load**, so the curvature of loaded and of
bending-dominated members is shown correctly. At hinged ends the true end slope is
back-calculated from the condition `M = 0`.

Internal forces are evaluated from the same field:

- `N = EA/L · (uⱼ − uᵢ)`, positive in **tension**
- `M = EI · v″`, positive for **sagging**
- `Q = dM/dx`

### Dynamic analysis

- **Mass:** lumped translational mass per node.
- **Damping:** each element may carry a **viscous axial damper** `c`, i.e. a dashpot in parallel
  with the axial spring of the member. The element damping matrices are condensed, rotated and
  assembled into a global damping matrix `C` exactly like the stiffness matrices.
- **Solution:** the damped equation of motion is transformed into the **standard form of the
  damped eigenvalue problem** — the second-order system is rewritten as a first-order state-space
  system in `[w, ẇ]`,

  ```
  A = [   0        I   ]
      [ −M⁻¹K   −M⁻¹C  ]
  ```

  whose complex eigenvalues `λ = σ ± i ω_d` and eigenvectors give the free response
  `w(t) = Σ φ_r · c_r · e^{λ_r t}`. The coefficients `c_r` are obtained from the initial
  displacements and velocities by solving the eigenvector system. This follows
  *Structural Dynamics*, section “8.2.3.2 The standard form of the damped eigenvalue problem”.

  From the eigenvalues the app derives, per mode:

  | quantity | expression |
  |---|---|
  | undamped natural frequency | `ω_n = |λ| = √(σ² + ω_d²)` |
  | damped natural frequency | `ω_d = Im λ` |
  | damping ratio | `ζ = −σ / ω_n` |
  | period | `T = 2π / ω_d` |
  | resonance frequency | `ω_r = ω_n · √(1 − 2ζ²)` (only for `ζ < 1/√2`) |

### Kinematic systems

Before any analysis, the free stiffness matrix `K₁₁` is checked for **zero eigenvalues**. If any
exist the system is kinematic (a mechanism) — the app flags this in the header and switches to a
dedicated view that animates the corresponding kinematic modes, which makes the missing support
or bracing easy to spot.

---

## Features

**Editor**

- Tabular input of nodes (coordinates, mass, supports `u` / `v` / `θ`), elements (`EA`, `EI`,
  damper `c`), hinges (element and end), nodal loads, element loads and initial conditions.
- Live blueprint preview of the structure next to the tables, including supports, hinge symbols,
  joint types and load arrows.
- Inputs are filtered by mode, so only quantities that the active model actually uses are shown.

**Static view**

- Deformed shape with a continuous deformation-scale slider.
- `N`, `Q` and `M` diagrams plotted directly on the structure, auto-scaled with an additional
  manual scale factor; the normal force diagram is coloured by tension/compression.
- Click an element to get its `N`, `V`, `M`, transverse and axial displacement diagrams in the
  side panel; click any diagram to enlarge it.
- Click a node to read out its coordinates, displacements `u`, `v`, `θ` and support condition.
- Toggles for the undeformed system, node markers, supports, member orientation (reference
  fibre), nodal loads and element loads.
- Plausibility warning when a member with `EI = 0` carries a transverse distributed load.

**Dynamic view**

- Animated free-vibration response with play/pause, restart, adjustable playback speed and a
  time display.
- Time-history charts for the displacement and the velocity of any free DOF, with configurable
  time window and sampling rate; charts can be enlarged.

**Eigenmodes**

- Table of all modes with `ω_n`, `ω_d`, `ω_r`, `ζ` and `T`, sorted by frequency.
- Animated mode shapes with automatic and manual amplitude scaling.

**General**

- Automatic fit-to-view with an adaptive, labelled background grid.
- Ghost overlay of the undeformed structure in every view.
- Support, joint and hinge symbols derived from the actual restraints and releases (square joint =
  rotation restrained, circle = free).
- **Import / export** of the complete system as a named JSON file — useful for sharing exercises
  or handing in results.

---

## Units

The tool is unit-agnostic: it performs no unit conversion. Use any **consistent** set of units
(e.g. m, kN, kNm², kg, s) and interpret the results accordingly.

---

## Getting started

```bash
npm install
npm run dev      # development server
npm run build    # production build
npm test         # unit tests (solver, force assembly, deformed shape)
```

Built with React 19 + TypeScript, Vite, Mantine, Konva (canvas rendering), math.js (linear
algebra and eigenvalue solution), Zustand and Chart.js.

---

## Current limitations and roadmap

- Rotational degrees of freedom and loads in **Dynamic** mode are not yet available (planned; the
  data model already provides frequency and phase-shift fields for harmonic loading).
- The dynamic solution covers **free vibration** from initial conditions; forced-response
  analysis is planned.
- Every free node in Dynamic mode needs a non-zero mass — a zero mass makes the mass matrix
  singular.
- Geometrically and materially **linear** analysis only; no buckling, no plasticity, no
  temperature or prestress loading.
