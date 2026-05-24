Extract initial conditions from Nodes, they are passed seperately to the Solver

Zero masses lead to crash

n.mass_moment_of_inertia


// 2. CONCEPTUAL JOINTS: Condense out releases inside the element loop
            if (hasReleases(e)) {
                k_local = applyStaticCondensation(k_local, e.releases_i, e.releases_j);
                c_local = applyStaticCondensation(c_local, e.releases_i, e.releases_j);
            }

    // Post-process reactions on demand using the element force method we discussed
        const reactions = this.calculateReactions(u_active);