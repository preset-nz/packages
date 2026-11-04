"""demo-kit: drive a real app window from outside, record it, cut the take.

Standard library only. The Swift tools it calls are built by
`just demo-kit::build` into packages/target/demo/. The edit is a module
(`from demokit.edit import edit`), not re-exported here, so that
`python3 -m demokit.edit` runs clean.
"""

from .take import Take
from .tools import Tools

__all__ = ["Take", "Tools"]
