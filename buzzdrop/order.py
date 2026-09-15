"""Delivery order shown in the HUD. Everything here is *display data* you choose."""
from __future__ import annotations

import tomllib
from dataclasses import dataclass, field, fields
from pathlib import Path


@dataclass
class Order:
    unit: str = "BZ-7"
    order_id: str = "#D-04817"
    pickup: str = "CAFE / BLOCK A"
    dropoff: str = "ROOM 214 / FLOOR 2"
    parcel: str = "1x COFFEE  0.35 KG"
    picked_up_at: str = "14:02:18"
    en_route_start_s: float = 131.0      # seconds already travelled when the clip starts
    route_length_m: float = 38.0
    remaining_m: float = 9.8             # metres left when the clip starts
    fee: str = "2.40 EUR"
    today_orders: int = 23
    on_time: str = "96 %"
    battery_start: float = 87.0
    battery_drain_per_s: float = 0.35
    heading_start: float = 212.0
    speed_min: float = 0.18              # m/s shown when the frame is still
    speed_max: float = 0.73              # m/s shown at peak image motion
    arriving_last_s: float = 1.6         # switch EN ROUTE -> ARRIVING this close to the end
    stages: list[str] = field(default_factory=lambda: ["ACCEPTED", "PICKED UP", "EN ROUTE", "DELIVERED"])

    def validate(self) -> "Order":
        if self.route_length_m <= 0:
            raise ValueError("route_length_m must be > 0")
        if not 0 <= self.remaining_m <= self.route_length_m:
            raise ValueError("remaining_m must be between 0 and route_length_m")
        if self.speed_max < self.speed_min:
            raise ValueError("speed_max must be >= speed_min")
        if len(self.stages) != 4:
            raise ValueError("stages must have exactly 4 labels")
        return self


def load(path: str | Path | None) -> Order:
    if path is None:
        return Order().validate()
    data = tomllib.loads(Path(path).read_text(encoding="utf-8"))
    data = data.get("order", data)
    known = {f.name for f in fields(Order)}
    unknown = set(data) - known
    if unknown:
        raise ValueError(f"unknown keys in {path}: {', '.join(sorted(unknown))}")
    return Order(**data).validate()


SAMPLE = '''# buzzdrop order card. Every value here is display data you choose.
[order]
unit = "BZ-7"
order_id = "#D-04817"
pickup = "CAFE / BLOCK A"
dropoff = "ROOM 214 / FLOOR 2"
parcel = "1x COFFEE  0.35 KG"
picked_up_at = "14:02:18"
en_route_start_s = 131
route_length_m = 38.0
remaining_m = 9.8
fee = "2.40 EUR"
today_orders = 23
on_time = "96 %"
battery_start = 87
battery_drain_per_s = 0.35
heading_start = 212
speed_min = 0.18
speed_max = 0.73
arriving_last_s = 1.6
stages = ["ACCEPTED", "PICKED UP", "EN ROUTE", "DELIVERED"]
'''
