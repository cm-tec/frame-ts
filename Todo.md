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




// 3. APPLY ROTATED BEARINGS VIA NODAL SIMILARITY TRANSFORMATION
        for (const n of system.nodes) {
            if (n.angle !== 0) {
                const alpha = n.angle;
                const c_a = Math.cos(alpha);
                const s_a = Math.sin(alpha);
                
                const T_node = matrix([
                    [ c_a, s_a, 0],
                    [-s_a, c_a, 0],
                    [   0,   0, 1]
                ]);
                const T_node_T = transpose(T_node);
                const idxs = [n.u_dof, n.v_dof, n.theta_dof];

                // Perform direct coordinate adjustments across the node block rows and columns
                for (let step = 0; step < system.ndofs; step += 3) {
                    const blockIdx = [step, step + 1, step + 2];

                    const col_block = subset(k, index(blockIdx, idxs));
                    k.subset(index(blockIdx, idxs), multiply(col_block, T_node_T));

                    const row_block = subset(k, index(idxs, blockIdx));
                    k.subset(index(idxs, blockIdx), multiply(T_node, row_block));
                }
            }
        }