
Zero masses lead to crash

n.mass_moment_of_inertia


validate internal forces calculation
validate displacement function of


make load assembly just skip invalid nodes and elements.


Redo Sidebar of StaticView
    - Group by element not by displacements
    - make it use the same function as deformedElementPoints
    - let it keep state of the selected diagrams

restrain forces

forces should move along with the node





applyStaticCondensation -> understand and document


x : right
y : up
z : out of plane        (right-handed)
θ : about +z → CCW
θ = +dv/dx


Everything angular in the solver is CCW-positive about +z, measured from +x. One rule, no exceptions.